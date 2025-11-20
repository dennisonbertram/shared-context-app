#!/usr/bin/env ts-node
import { startMcpServer } from './server';

startMcpServer().catch((error) => {
  console.error('MCP server crashed:', error);
  process.exit(1);
});

