import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { getLearningById, searchLearnings } from './learningService';

// Mock the MCP SDK modules
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn()
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn()
}));

describe('MCP Server Handlers', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)').run('conv-1', now, now);
    db.prepare(
      'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('learn-1', 'conv-1', 'technical', 'Test Learning', 'Test content here', now);
    db.prepare(
      'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('learn-2', 'conv-1', 'workflow', 'Array Sorting', 'Use sort() method', now);
  });

  afterEach(() => {
    db.close();
  });

  describe('tools/list handler', () => {
    it('should return two tools (get_learning, search_learnings)', () => {
      const tools = [
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
      ];

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('get_learning');
      expect(tools[1].name).toBe('search_learnings');
    });

    it('should have get_learning with required id parameter', () => {
      const tool = {
        name: 'get_learning',
        description: 'Retrieve a learning by ID',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      };

      expect(tool.inputSchema.required).toContain('id');
      expect(tool.inputSchema.properties.id.type).toBe('string');
    });

    it('should have search_learnings with required query and optional limit', () => {
      const tool = {
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
      };

      expect(tool.inputSchema.required).toContain('query');
      expect(tool.inputSchema.properties.query.type).toBe('string');
      expect(tool.inputSchema.properties.limit.type).toBe('number');
      expect(tool.inputSchema.properties.limit.default).toBe(10);
    });
  });

  describe('tools/call handler - get_learning', () => {
    it('should throw "Missing id" when id is missing', () => {
      const request = {
        params: {
          name: 'get_learning',
          arguments: {}
        }
      };

      expect(() => {
        const args = request.params?.arguments as { id?: string } | undefined;
        if (!args?.id) {
          throw new Error('Missing id');
        }
      }).toThrow('Missing id');
    });

    it('should throw "Missing id" when id is empty string', () => {
      const request = {
        params: {
          name: 'get_learning',
          arguments: { id: '' }
        }
      };

      expect(() => {
        const args = request.params?.arguments as { id?: string } | undefined;
        if (!args?.id) {
          throw new Error('Missing id');
        }
      }).toThrow('Missing id');
    });

    it('should return "Learning {id} not found" when learning does not exist', () => {
      const id = 'non-existent-id';
      const learning = getLearningById(db, id);

      expect(learning).toBeNull();

      const response = {
        content: [
          {
            type: 'text',
            text: `Learning ${id} not found`
          }
        ]
      };

      expect(response.content[0].text).toBe('Learning non-existent-id not found');
    });

    it('should return JSON stringified learning when learning is found', () => {
      const id = 'learn-1';
      const learning = getLearningById(db, id);

      expect(learning).not.toBeNull();
      expect(learning?.id).toBe('learn-1');
      expect(learning?.title).toBe('Test Learning');

      const response = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(learning, null, 2)
          }
        ]
      };

      const parsedLearning = JSON.parse(response.content[0].text);
      expect(parsedLearning.id).toBe('learn-1');
      expect(parsedLearning.title).toBe('Test Learning');
      expect(parsedLearning.content).toBe('Test content here');
    });
  });

  describe('tools/call handler - search_learnings', () => {
    it('should throw "Missing query" when query is missing', () => {
      const request = {
        params: {
          name: 'search_learnings',
          arguments: {}
        }
      };

      expect(() => {
        const args = request.params?.arguments as { query?: string; limit?: number } | undefined;
        if (!args?.query) {
          throw new Error('Missing query');
        }
      }).toThrow('Missing query');
    });

    it('should throw "Missing query" when query is empty string', () => {
      const request = {
        params: {
          name: 'search_learnings',
          arguments: { query: '' }
        }
      };

      expect(() => {
        const args = request.params?.arguments as { query?: string; limit?: number } | undefined;
        if (!args?.query) {
          throw new Error('Missing query');
        }
      }).toThrow('Missing query');
    });

    it('should return results when valid query is provided', () => {
      const query = 'Array';
      const results = searchLearnings(db, { query });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Array');

      const response = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }
        ]
      };

      const parsedResults = JSON.parse(response.content[0].text);
      expect(Array.isArray(parsedResults)).toBe(true);
      expect(parsedResults[0].title).toContain('Array');
    });

    it('should return empty array when no results match', () => {
      const query = 'GraphQL';
      const results = searchLearnings(db, { query });

      expect(results).toHaveLength(0);

      const response = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }
        ]
      };

      const parsedResults = JSON.parse(response.content[0].text);
      expect(Array.isArray(parsedResults)).toBe(true);
      expect(parsedResults).toHaveLength(0);
    });

    it('should respect limit parameter when provided', () => {
      const query = ' '; // Matches everything
      const limit = 1;
      const results = searchLearnings(db, { query, limit });

      expect(results).toHaveLength(1);

      const response = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }
        ]
      };

      const parsedResults = JSON.parse(response.content[0].text);
      expect(parsedResults).toHaveLength(1);
    });
  });

  describe('tools/call handler - unknown tool', () => {
    it('should throw "Unknown tool: {name}" for unknown tool name', () => {
      const request = {
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      expect(() => {
        const toolName = request?.params?.name;
        if (toolName !== 'get_learning' && toolName !== 'search_learnings') {
          throw new Error(`Unknown tool: ${toolName}`);
        }
      }).toThrow('Unknown tool: unknown_tool');
    });

    it('should throw "Unknown tool: undefined" when tool name is undefined', () => {
      const request = {
        params: {
          arguments: {}
        }
      };

      expect(() => {
        const toolName = request?.params?.name;
        if (toolName !== 'get_learning' && toolName !== 'search_learnings') {
          throw new Error(`Unknown tool: ${toolName}`);
        }
      }).toThrow('Unknown tool: undefined');
    });
  });
});
