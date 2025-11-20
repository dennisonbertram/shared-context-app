import { join } from 'path';
import Database from 'better-sqlite3';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSchema } from '../db/schema';
import { getLearningById } from './learningService';
import { searchLearnings } from './searchService';

export interface McpServerOptions {
  dbPath?: string;
  transport?: 'stdio';
}

type McpRequest = {
  params?: {
    name?: string;
    arguments?: unknown;
  };
};

interface McpServer {
  setRequestHandler: (method: string, handler: (request: McpRequest) => Promise<unknown>) => void;
}

export async function startMcpServer(options?: McpServerOptions): Promise<void> {
  const dbPath = options?.dbPath ?? join(process.cwd(), 'data/context.db');
  const db = new Database(dbPath);
  createSchema(db);

  const server = new Server(
    {
      name: 'gcn-mcp-server',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const mcp = server as McpServer;

  mcp.setRequestHandler('tools/list', async () => ({
    tools: [
      {
        name: 'get_learning',
        description: 'Retrieve a learning by ID',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      },
      {
        name: 'search_learnings',
        description: 'Search learnings by keyword',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number', default: 10 }
          },
          required: ['query']
        }
      }
    ]
  }));

  mcp.setRequestHandler('tools/call', async (request: McpRequest) => {
    const toolName = request?.params?.name;

    if (toolName === 'get_learning') {
      const args = request.params?.arguments as { id?: string } | undefined;
      if (!args?.id) {
        throw new Error('Missing id');
      }

      const { id } = args;
      const learning = getLearningById(db, id);

      if (!learning) {
        return {
          content: [
            {
              type: 'text',
              text: `Learning ${id} not found`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(learning, null, 2)
          }
        ]
      };
    }

    if (toolName === 'search_learnings') {
      const args = request.params?.arguments as { query?: string; limit?: number } | undefined;
      if (!args?.query) {
        throw new Error('Missing query');
      }

      const { query, limit } = args;
      const results = searchLearnings(db, query, limit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }
        ]
      };
    }

    throw new Error(`Unknown tool: ${toolName}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

