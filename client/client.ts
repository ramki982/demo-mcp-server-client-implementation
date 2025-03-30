import rl from 'node:readline/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import OpenAI from 'openai';
import type { FunctionTool } from 'openai/resources/responses/responses.mjs';

class ChatHandler {
  private chatHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  private aiGreetingText = 'How can I help you today?';
  private model: OpenAI;
  private client: Client;
  private tools: { resources: FunctionTool[]; tools: FunctionTool[] };
  private ui: rl.Interface;

  constructor(
    model: OpenAI,
    client: Client,
    tools: { resources: FunctionTool[]; tools: FunctionTool[] },
    ui: rl.Interface
  ) {
    this.model = model;
    this.client = client;
    this.tools = tools;
    this.ui = ui;
  }

  async processResponse(response: any) {
    if (response.type === 'function_call') {
      await this.handleToolCall(response);
    } else if (response.type === 'reasoning') {
      this.chatHistory.push({
        role: 'assistant',
        content: response.summary.join('\n'),
      });
    } else if (
      response.type === 'message' &&
      (response.content[0]?.type === 'output_text' ||
        response.content[0]?.type === 'refusal')
    ) {
      this.chatHistory.push({
        role: 'assistant',
        content:
          response.content[0].type === 'output_text'
            ? response.content[0].text
            : response.content[0].refusal,
      });
    }
    this.ui.write(
      this.chatHistory[this.chatHistory.length - 1]?.content + '\n'
    );
  }

  private async handleToolCall(response: {
    name: string;
    arguments: string;
  }) {
    const toolName = response.name;
    const toolResponse = await this.callToolOrResource(
      toolName,
      response.arguments
    );
    this.chatHistory.push({
      role: 'user',
      content: toolResponse,
    });
  }

  private async callToolOrResource(toolName: string, args: string) {
    if (this.isTool(toolName)) {
      const { content } = await this.client.callTool({
        name: toolName,
        arguments: JSON.parse(args),
      });
      return Array.isArray(content) && content.length > 0
        ? 'Result received from function call: ' + content[0].text
        : 'No response from the tool.';
    } else if (this.isResource(toolName)) {
      const { contents } = await this.client.readResource({
        uri: 'knowledge://' + toolName,
      });
      return 'Result received from reading resource: ' + contents[0]!.text;
    }

    return 'Tool not found.';
  }

  private isTool(name: string) {
    return this.tools.tools.some((tool) => tool.name === name);
  }

  private isResource(name: string) {
    return this.tools.resources.some((tool) => tool.name === name);
  }

  async handleChat() {
    if (this.chatHistory.length > 0) {
      const { output_text } = await this.model.responses.create({
        model: 'gpt-4.5-preview',
        instructions:
          'Based on the provided history, derive a friendly answer or summary (if any of that is needed) or follow-up question.',
        input: this.chatHistory.slice(-3),
      });
      this.aiGreetingText = output_text;
    }

    const prompt = await this.ui.question(this.aiGreetingText + '\n');
    this.chatHistory.push({ role: 'user', content: prompt });

    const result = await this.model.responses.create({
      model: 'gpt-4o-mini',
      instructions:
        'You are a helpful, friendly assistant. You can use knowledge-related tools to find information on specific topics or store new knowledge.',
      input: this.chatHistory,
      tools: [...this.tools.tools, ...this.tools.resources],
    });

    if (result.output.length === 0) {
      console.log('No response from the assistant.');
      return;
    }

    await this.processResponse(result.output[0]);
  }
}

function setupOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required.');
  }
  return new OpenAI({ apiKey });
}

async function setupMcpTools(client: Client) {
  const mcpResources = await client.listResources();
  const resourceTools: FunctionTool[] = mcpResources.resources.map((res) => ({
    type: 'function',
    description: res.description,
    strict: true,
    name: res.name,
    parameters: {
      type: 'object',
      properties: { topic: { type: 'string' } },
      required: ['topic'],
      additionalProperties: false,
    },
  }));

  const mcpTools = await client.listTools();
  const toolTools: FunctionTool[] = mcpTools.tools.map((tool) => ({
    type: 'function',
    strict: true,
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['topic', 'content'],
      additionalProperties: false,
    },
  }));

  return { resources: resourceTools, tools: toolTools };
}

async function main() {
  try {
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['../server/server.ts'],
    });

    const client = new Client(
      { name: 'demo-client', version: '1.0.0' },
      { capabilities: { prompts: {}, resources: {}, tools: {} } }
    );

    await client.connect(transport);

    const model = setupOpenAI();
    const tools = await setupMcpTools(client);
    const ui = rl.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const chatHandler = new ChatHandler(model, client, tools, ui);

    while (true) {
      await chatHandler.handleChat();
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
