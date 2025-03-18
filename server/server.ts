import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'Demo',
  version: '1.0.0',
});

// Exposing a tool that manipulates stored data
server.tool(
  'store-knowledge',
  { topic: z.string(), content: z.string() },
  async ({ topic, content }) => {
    try {
      const response = await fetch('http://localhost:8080/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, content }),
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to store knowledge, received response status: ${response.statusText}`,
            },
          ],
        };
      }

      return {
        content: [{ type: 'text', text: `Stored: ${topic} - ${content}` }],
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to store knowledge, received error: ${error.message}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Failed to store knowledge, received error: ${error}`,
          },
        ],
      };
    }
  }
);

// Exposing data to the LLM
server.resource(
  'knowledge-for-topic',
  new ResourceTemplate('knowledge://{topic}', {
    list: async () => {
      try {
        const response = await fetch('http://localhost:8080/knowledge');

        if (!response.ok) {
          return { resources: [] };
        }

        const data = (await response.json()) as string[];

        return {
          resources: data.map((topic) => ({
            uri: `knowledge://${topic}`,
            description: 'A stored piece of knowledge - speficially, stored knowledge about topic: ' + topic,
            name: topic,
          })),
        };
      } catch (error) {
        return { resources: [] };
      }
    },
  }),
  async (uri, { topic }) => {
    try {
      const response = await fetch(
        `http://localhost:8080/knowledge?topic=${topic}`
      );

      if (!response.ok) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Failed to retrieve knowledge for topic: ${topic}, received response status: ${response.statusText}`,
            },
          ],
        };
      }

      const data = await response.json();

      return {
        contents: [
          {
            uri: uri.href,
            text: `Knowledge for topic: ${topic} - ${data.content}`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Failed to retrieve knowledge for topic: ${topic}, received error: ${error.message}`,
            },
          ],
        };
      }
      return {
        contents: [
          {
            uri: uri.href,
            text: `Failed to retrieve knowledge for topic: ${topic}, received error: ${error}`,
          },
        ],
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
