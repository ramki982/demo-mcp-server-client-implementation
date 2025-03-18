# Example MCP Server + Client Implementation

I [wrote an article](https://maximilian-schwarzmueller.com/articles/whats-the-mcp-model-context-protocol-hype-all-about) and [created a video](https://youtu.be/sVC4DL2secQ) about MCPs and why they're useful in my opinion.

This demo project contains a backend service / API that's consumed by a MCP server which exposes it in a standardized way to MCP clients - like the example MCP client (a very simple AI chatbot) that's also part of this project.

**Important:** All three parts (service, server, client) rely on Node.js being able to execute TypeScript without a compilation step. [Yes, modern Node.js can do that!](https://maximilian-schwarzmueller.com/articles/modern-nodejs-can-do-that/#built-in-typescript-support) **Make sure you have Node.js 23.x or higher installed!**

## Configuration

Add a `.env` file inside the `client` folder (next to the `package.json` file there) and add the following content to it:

```
OPENAI_API_KEY=<your-open-ai-key>
```

In each folder (`service`, `server`, `client`) run `npm install` to install required dependencies.

## Running Service, MCP Server & MCP Client

For each part, navigate into the respective folder (`service`, `server` and `client`) and run `npm run dev` (with Node.js 23+). Keep each process running.

The "client" process is a simply AI chatbot using OpenAI behind the scenes. This chatbot has the custom MCP server "installed" - therefore, this AI chat application is able to store and retrieve custom information via the backend service created in the "service" folder.

Bugs are possible - it's just a basic demo implementation :-)