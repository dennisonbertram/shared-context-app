---
title: MCP Server Setup Guide
category: guide
date: 2025-01-27
status: active
authors: Claude + Dennison
tags: [mcp, server, setup, configuration, learnings]
difficulty: beginner
estimated_time: 20-30 minutes
prerequisites:
  - Project built (npm run build)
  - Database initialized (npm run db:migrate)
  - Node.js 18+ installed
references:
  - docs/architecture/architecture-mcp-integration.md
  - README.md
  - src/mcp/server.ts
---

# MCP Server Setup Guide

> Step-by-step guide to configure and use the Global Context Network MCP server for querying learnings from Claude Code conversations.

---

## Overview

The Global Context Network MCP server exposes learnings captured from your Claude Code conversations via the Model Context Protocol. Once configured, any MCP-compatible client (like Claude Code or Claude Desktop) can query your learnings to retrieve insights from past conversations.

**What You'll Build**:
- MCP server configuration for project-scoped or user-scoped access
- Integration with Claude Code for querying learnings
- Verification that the MCP server is working correctly

**What the MCP Server Does**:
- Provides `get_learning` tool to retrieve a specific learning by ID
- Provides `search_learnings` tool to search learnings by keyword
- Reads from the SQLite database at `./data/context.db`
- Returns sanitized learnings (all PII already removed)

**Time Estimate**: 20-30 minutes

---

## Prerequisites

Before starting, ensure you have:

1. **Project Built**
   ```bash
   npm run build
   ```
   This compiles TypeScript to `dist/` directory, including `dist/mcp/server.js`.

2. **Database Initialized**
   ```bash
   npm run db:migrate
   ```
   This creates `data/context.db` with the canonical schema.

3. **Node.js 18+** installed
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

4. **Some Learnings in Database** (optional but recommended for testing)
   - If you've already captured conversations via hooks, you'll have learnings
   - Otherwise, you can test with an empty database and add learnings later

---

## Step 1: Choose Configuration Scope

You can configure the MCP server at two levels:

### Option A: Project-Scoped (Recommended for Development)

**Use When**: You want the MCP server to only work for this specific project.

**Configuration File**: `.mcp.json` in project root

**Pros**:
- Easy to test and debug
- Project-specific configuration
- Can commit to version control (if desired)

**Cons**:
- Only available when working in this project directory
- Must reconfigure for other projects

### Option B: User-Scoped (Recommended for Production)

**Use When**: You want learnings available across all Claude Code sessions.

**Configuration File**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Pros**:
- Works globally across all projects
- Learnings available in any conversation

**Cons**:
- Harder to debug (global configuration)
- Must use absolute paths

---

## Step 2: Create Configuration File

### For Project-Scoped Setup

Create `.mcp.json` in the project root:

```bash
cd /Users/dennisonbertram/Develop/apps/shared-context-app/.conductor/riga
```

Create the file with this content:

```json
{
  "mcpServers": {
    "gcn-learnings": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp/server.js"],
      "env": {
        "DB_PATH": "./data/context.db"
      }
    }
  }
}
```

**Configuration Breakdown**:
- `"gcn-learnings"`: Server name (shown in Claude Code)
- `"type": "stdio"`: Uses standard input/output for communication
- `"command": "node"`: Runs the server with Node.js
- `"args": ["./dist/mcp/server.js"]`: Path to compiled server (relative to project root)
- `"env.DB_PATH"`: Database location (relative to project root)

### For User-Scoped Setup

Add this to your Claude Desktop configuration file:

**macOS Example** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gcn-learnings": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/Users/dennisonbertram/Develop/apps/shared-context-app/.conductor/riga/dist/mcp/server.js"
      ],
      "env": {
        "DB_PATH": "/Users/dennisonbertram/Develop/apps/shared-context-app/.conductor/riga/data/context.db"
      }
    }
  }
}
```

**IMPORTANT**: Use absolute paths for user-scoped configuration.

**If You Have Existing MCP Servers**:

Merge the `gcn-learnings` entry into your existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": {
      "type": "stdio",
      "command": "...",
      "args": ["..."]
    },
    "gcn-learnings": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/dist/mcp/server.js"],
      "env": {
        "DB_PATH": "/absolute/path/to/data/context.db"
      }
    }
  }
}
```

---

## Step 3: Verify MCP Server is Running

### Check Available MCP Servers

In Claude Code, use the `/mcp` command:

```bash
/mcp
```

**Expected Output**:
```
Available MCP Servers:
- gcn-learnings (2 tools)
  - get_learning
  - search_learnings
```

If you see `gcn-learnings` listed, the MCP server is configured correctly!

### Test Server Manually (Optional)

You can also test the MCP server directly:

```bash
# Run the server manually
npm run mcp:server

# Or with ts-node directly
npx ts-node src/mcp/runServer.ts
```

The server will start and wait for MCP protocol messages on stdin. Press `Ctrl+C` to stop.

**Note**: This is mostly useful for debugging. Normal usage is through Claude Code's automatic MCP server management.

---

## Step 4: Use MCP Tools

### Tool 1: `get_learning` - Retrieve by ID

**Purpose**: Get a specific learning by its ULID.

**Input Schema**:
```typescript
{
  id: string  // ULID of the learning (required)
}
```

**Example Query in Claude Code**:
```
Get learning with ID 01HQ2X3Y4Z5A6B7C8D9E0F1G2H
```

**Expected Response**:
```json
{
  "id": "01HQ2X3Y4Z5A6B7C8D9E0F1G2H",
  "conversation_id": "01HQ2X3Y4Z5A6B7C8D9E0F1G2I",
  "category": "best_practice",
  "title": "Use async/await for database queries",
  "content": "When working with better-sqlite3, always use .prepare() and .all()/.get() for safe, parameterized queries. Avoid string concatenation to prevent SQL injection.",
  "created_at": "2025-01-27T10:30:00.000Z"
}
```

**If Learning Not Found**:
```
Learning 01HQ2X3Y4Z5A6B7C8D9E0F1G2H not found
```

### Tool 2: `search_learnings` - Search by Keyword

**Purpose**: Search learnings by keyword in title or content.

**Input Schema**:
```typescript
{
  query: string,      // Search term (required)
  limit?: number      // Max results (optional, default: 10, max: 50)
}
```

**Example Query in Claude Code**:
```
Search learnings for "typescript"
```

**Expected Response**:
```json
[
  {
    "id": "01HQ2X3Y4Z5A6B7C8D9E0F1G2H",
    "conversation_id": "01HQ2X3Y4Z5A6B7C8D9E0F1G2I",
    "category": "best_practice",
    "title": "TypeScript strict mode best practices",
    "content": "Always enable strict mode in tsconfig.json for better type safety...",
    "created_at": "2025-01-27T09:15:00.000Z"
  },
  {
    "id": "01HQ2X3Y4Z5A6B7C8D9E0F1G2J",
    "conversation_id": "01HQ2X3Y4Z5A6B7C8D9E0F1G2K",
    "category": "pattern",
    "title": "TypeScript discriminated unions",
    "content": "Use discriminated unions with a 'type' field for type-safe state machines...",
    "created_at": "2025-01-26T14:22:00.000Z"
  }
]
```

**If No Results**:
```json
[]
```

### Advanced Search Examples

**Limit Results**:
```
Search learnings for "database" with limit 5
```

**Multiple Keywords** (searches for either):
```
Search learnings for "async await promise"
```
This searches for learnings containing "async", "await", OR "promise".

**Exact Phrases**:
The search uses SQL `LIKE` with wildcards, so it's substring matching:
```
Search learnings for "better-sqlite3"
```

---

## Step 5: Verify End-to-End

### Verification Checklist

1. **Configuration File Exists**
   ```bash
   # For project-scoped
   cat .mcp.json

   # For user-scoped (macOS)
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | grep gcn-learnings
   ```

2. **Built Server Exists**
   ```bash
   ls -la dist/mcp/server.js
   # Should show the compiled server file
   ```

3. **Database Exists**
   ```bash
   ls -la data/context.db
   # Should show the database file
   ```

4. **MCP Server Listed**
   ```
   /mcp
   # Should show gcn-learnings with 2 tools
   ```

5. **Search Returns Results** (if you have learnings)
   ```
   Search learnings for "test"
   # Should return matching learnings or empty array
   ```

---

## Troubleshooting

### Issue: MCP Server Not Listed in `/mcp`

**Symptoms**: `gcn-learnings` doesn't appear in MCP server list.

**Solutions**:

1. **Check Configuration File Path**
   ```bash
   # Project-scoped: must be in project root
   ls -la .mcp.json

   # User-scoped: check config directory
   ls -la ~/Library/Application\ Support/Claude/
   ```

2. **Verify JSON Syntax**
   ```bash
   # Test JSON parsing (should not error)
   node -e "console.log(JSON.parse(require('fs').readFileSync('.mcp.json', 'utf8')))"
   ```

3. **Check File Paths are Correct**
   ```bash
   # Verify server exists
   ls dist/mcp/server.js

   # Verify database exists
   ls data/context.db
   ```

4. **Restart Claude Code**
   - MCP configuration is loaded on startup
   - Close and reopen Claude Code after configuration changes

5. **Check for Absolute vs Relative Paths**
   - Project-scoped (`.mcp.json`): Use relative paths (`./dist/...`)
   - User-scoped: Use absolute paths (`/Users/.../dist/...`)

### Issue: Server Crashes on Startup

**Symptoms**: Error messages when Claude Code starts.

**Solution 1: Check Build**
```bash
# Rebuild the project
npm run build

# Verify server.js exists
ls -la dist/mcp/server.js
```

**Solution 2: Check Database Path**
```bash
# Verify database exists
ls -la data/context.db

# If missing, create it
npm run db:migrate
```

**Solution 3: Check Node Version**
```bash
node --version
# Must be 18.0.0 or higher
```

**Solution 4: Check Environment Variables**
```json
{
  "env": {
    "DB_PATH": "./data/context.db",
    "NODE_ENV": "production"
  }
}
```

### Issue: `get_learning` Returns "Not Found"

**Symptoms**: Query with valid ID returns "Learning not found".

**Solutions**:

1. **Verify Learning Exists**
   ```bash
   sqlite3 data/context.db "SELECT id, title FROM learnings LIMIT 5;"
   ```

2. **Check ID Format**
   - IDs are ULIDs (26 characters)
   - Example: `01HQ2X3Y4Z5A6B7C8D9E0F1G2H`
   - Case-sensitive

3. **Verify Database Path**
   - Check `DB_PATH` in `.mcp.json` points to correct database
   - Use absolute path if unsure:
     ```json
     "env": {
       "DB_PATH": "/full/path/to/data/context.db"
     }
     ```

### Issue: `search_learnings` Returns Empty Array

**Symptoms**: Search returns `[]` even though learnings exist.

**Solutions**:

1. **Check Database Has Learnings**
   ```bash
   sqlite3 data/context.db "SELECT COUNT(*) FROM learnings;"
   ```

2. **Verify Search Term**
   - Search is case-insensitive
   - Uses substring matching (`LIKE '%term%'`)
   - Try broader terms: `search learnings for "a"`

3. **Check Database Connection**
   ```bash
   # Run server manually to see errors
   npm run mcp:server
   ```

### Issue: Permission Denied Errors

**Symptoms**: `EACCES` or permission errors when starting server.

**Solutions**:

1. **Check File Permissions**
   ```bash
   # Server should be readable
   ls -la dist/mcp/server.js

   # Database should be readable/writable
   ls -la data/context.db
   ```

2. **Fix Permissions**
   ```bash
   # Make server executable
   chmod +x dist/mcp/server.js

   # Fix database permissions
   chmod 644 data/context.db
   ```

3. **Check Directory Permissions**
   ```bash
   # Ensure data directory is accessible
   ls -la data/
   ```

---

## Configuration Options

### Environment Variables

You can customize the MCP server with environment variables:

```json
{
  "mcpServers": {
    "gcn-learnings": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp/server.js"],
      "env": {
        "DB_PATH": "./data/context.db",
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Available Variables**:
- `DB_PATH`: Path to SQLite database (required)
- `NODE_ENV`: Environment mode (`production`, `development`)
- `LOG_LEVEL`: Logging verbosity (`error`, `warn`, `info`, `debug`)

### Multiple Databases

You can configure multiple MCP servers for different databases:

```json
{
  "mcpServers": {
    "gcn-learnings-work": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp/server.js"],
      "env": {
        "DB_PATH": "./data/work.db"
      }
    },
    "gcn-learnings-personal": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp/server.js"],
      "env": {
        "DB_PATH": "./data/personal.db"
      }
    }
  }
}
```

---

## Production Checklist

Before using in production:

- [ ] **Server Builds Successfully**
  ```bash
  npm run build
  ls dist/mcp/server.js  # Should exist
  ```

- [ ] **Database Initialized**
  ```bash
  ls data/context.db  # Should exist
  ```

- [ ] **Configuration File Valid JSON**
  ```bash
  node -e "JSON.parse(require('fs').readFileSync('.mcp.json', 'utf8'))"
  ```

- [ ] **MCP Server Listed**
  ```
  /mcp  # Should show gcn-learnings
  ```

- [ ] **Tools Return Expected Output**
  ```
  search learnings for "test"
  # Should return array (empty or with results)
  ```

- [ ] **Database Permissions Secure**
  ```bash
  ls -la data/context.db
  # Should be -rw-r--r-- (644) or more restrictive
  ```

- [ ] **No PII in Learnings** (verified by sanitization tests)
  ```bash
  npm test -- sanitization
  ```

---

## Next Steps

After MCP server is configured:

1. **Capture Learnings** - Use hooks to capture conversations
   - See: `docs/guides/guide-phase-1-hook-development-2025-01-16.md`

2. **Query in Conversations** - Ask Claude Code to search your learnings
   ```
   What have I learned about database optimization?
   ```

3. **Monitor Usage** - Track which learnings are most useful
   - Add analytics to MCP server (future enhancement)

4. **Share Learnings** - Export to IPFS and blockchain (future phases)
   - See: `docs/plans/plan-phase-6-ipfs-storage-2025-01-16.md`

5. **Customize Search** - Extend search with more filters
   - Filter by category, date range, confidence
   - See: `src/mcp/learningService.ts`

---

## Additional Resources

### Documentation
- [README.md](../../README.md) - Project overview
- [MCP Integration Architecture](../architecture/architecture-mcp-integration.md) - MCP design
- [Database Schema Reference](../reference/reference-database-schema-2025-01-16.md) - Learnings table schema

### External Links
- [Model Context Protocol](https://modelcontextprotocol.io/) - Official MCP documentation
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk) - TypeScript SDK
- [Claude Code MCP Guide](https://docs.anthropic.com/claude-code/mcp) - MCP in Claude Code

### Source Code
- `src/mcp/server.ts` - MCP server implementation
- `src/mcp/learningService.ts` - Get learning by ID and search learnings

---

## Summary

You now have a configured MCP server that:

✅ Exposes learnings via Model Context Protocol
✅ Provides `get_learning(id)` tool for specific retrieval
✅ Provides `search_learnings(query, limit?)` tool for keyword search
✅ Works with project-scoped or user-scoped configuration
✅ Reads from sanitized SQLite database (no PII exposure)
✅ Integrates with Claude Code for natural language queries

**Configuration File**:
- Project: `.mcp.json`
- User: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Next**: Start querying your learnings in Claude Code conversations!

---

**Questions or Issues?**

- Check the troubleshooting section above
- Verify all prerequisites are met
- Review the configuration examples
- Ensure paths are correct (relative vs absolute)
- Restart Claude Code after configuration changes
