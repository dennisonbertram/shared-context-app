# Claude Code Hooks Alignment Remediation Report

> Critical fixes required to align repository documentation with actual Claude Code hooks implementation

---
title: Claude Code Hooks Alignment Remediation Report
category: review
date: 2025-01-17
status: active
priority: critical
authors: Claude Code Assistant
tags: [hooks, alignment, critical-fixes, claude-code]
---

## Executive Summary

A comprehensive audit of this repository's Claude Code hooks documentation revealed **14 significant issues**, including **6 CRITICAL** architectural misalignments that would prevent the hook system from functioning. This document provides a complete remediation plan.

**Status**: ⚠️ **IMPLEMENTATION BLOCKED** - Do not proceed until critical issues are resolved.

## Critical Issues Identified

### CRITICAL #1: Hook Configuration File Location and Format

**Current Documentation Says**:
```json
// .claude/hooks.json
{
  "hooks": {
    "UserPromptSubmit": {
      "command": "node",
      "args": [".claude/hooks/capture-prompt.js"],
      "timeout": 100
    }
  }
}
```

**Official Claude Code Hooks Specification**:
```json
// .claude/settings.json (NOT hooks.json)
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",  // or omit matcher for non-tool events
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/capture-prompt.js",
            "timeout": 100
          }
        ]
      }
    ]
  }
}
```

**Impact**: Complete failure - hooks won't be recognized
**Files Affected**:
- `docs/decisions/decision-use-claude-hooks-2025-01-16.md` (lines 165-180)
- `docs/architecture/architecture-hooks-event-capture-2025-01-16.md` (lines 236-260)
- `docs/reference/reference-hook-configuration-2025-01-16.md`

**Fix Required**:
1. Change all references from `.claude/hooks.json` to `.claude/settings.json`
2. Update configuration structure to use matcher/hooks array pattern
3. Combine command and args into single "command" string
4. Add "type": "command" field

### CRITICAL #2: Hook Input Method

**Current Documentation Says**:
```typescript
// Reads from process.argv or environment variables
const hookData = process.argv[2];
```

**Official Specification**:
```typescript
// Reads JSON from stdin
const payload = await readStdin();
const hookData = JSON.parse(payload);
```

**Impact**: Hook scripts will receive no data
**Files Affected**:
- `docs/architecture/architecture-hooks-event-capture-2025-01-16.md` (lines 148-186)

**Fix Required**:
```typescript
// Add stdin reader utility
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}
```

### CRITICAL #3: Missing Hook Events

**Current Documentation Mentions**: UserPromptSubmit, Stop

**Official Specification Provides**:
1. PreToolUse - Before tool execution (can block)
2. PostToolUse - After tool execution
3. **UserPromptSubmit** - When user submits prompt ✓
4. **Stop** - When agent finishes ✓
5. SubagentStop - When subagent finishes
6. Notification - When notifications sent
7. PreCompact - Before compaction
8. SessionStart - Session initialization
9. SessionEnd - Session termination
10. PermissionRequest - Permission dialogs

**Impact**: Missing critical integration points
**Files Affected**: All architecture and planning documents

**Fix Required**: Document all 10 hook events with use cases:
- **PostToolUse**: Validate writes/edits succeeded, trigger formatters
- **PreCompact**: Flush pending events before compaction
- **SessionStart**: Initialize event queue, load context
- **SessionEnd**: Cleanup, final flush of events
- **SubagentStop**: Capture subagent completions

### CRITICAL #4: Hook Input Schema Misalignment

**Current Documentation Assumes**:
```typescript
interface HookData {
  prompt?: string;
  response?: string;
  toolCalls?: ToolCall[];
}
```

**Official Schema for UserPromptSubmit**:
```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Write a function..."
}
```

**Official Schema for Stop**:
```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf.jsonl",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": true
}
```

**Impact**: Cannot parse hook data correctly
**Files Affected**:
- `docs/architecture/architecture-hooks-event-capture-2025-01-16.md` (lines 84-131)
- `docs/reference/reference-event-schema-2025-01-16.md`

**Fix Required**:
1. Update event schema to match official input format
2. **CRITICAL**: Stop hook does NOT receive agent response directly - must read from transcript_path
3. Add transcript parsing logic to extract response

### CRITICAL #5: Environment Variable Usage

**Current Documentation Shows**:
```typescript
process.env.NODE_ENV = 'hook';
```

**Official Environment Variables**:
- `CLAUDE_PROJECT_DIR`: Project root directory (available in all hooks)
- `CLAUDE_ENV_FILE`: File path for persisting env vars (SessionStart ONLY)
- `CLAUDE_CODE_REMOTE`: "true" if remote/web environment, unset for local CLI
- `CLAUDE_PLUGIN_ROOT`: Plugin directory (plugins only)

**Impact**: Missing critical project context
**Files Affected**:
- `docs/architecture/architecture-hooks-event-capture-2025-01-16.md` (lines 682-697)

**Fix Required**:
1. Use `$CLAUDE_PROJECT_DIR` for project-relative paths
2. Document CLAUDE_ENV_FILE for SessionStart hooks
3. Add CLAUDE_CODE_REMOTE detection for environment-specific logic
4. Update example hook commands to use proper env vars

### CRITICAL #6: Hook Output Format

**Current Documentation Says**: Exit code only

**Official Specification**:
```json
{
  "continue": true,              // Whether Claude should continue
  "stopReason": "string",        // Message shown when continue is false
  "suppressOutput": true,        // Hide stdout from transcript
  "systemMessage": "string",     // Warning message to user
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Context to add"
  }
}
```

**For PreToolUse**:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow" | "deny" | "ask",
    "permissionDecisionReason": "Reason",
    "updatedInput": { /* modified tool input */ }
  }
}
```

**Impact**: Cannot use advanced hook features
**Files Affected**: All hook implementation examples

**Fix Required**: Document JSON output schemas for all hook events

## High Priority Issues

### HIGH #1: Timeout Budget Confusion

**Documentation States**: 100ms timeout
**Official Default**: 60 seconds, configurable

**Clarification Needed**:
- 100ms is the PERFORMANCE BUDGET (non-blocking requirement)
- 60s is the TIMEOUT (fail-safe for hung hooks)
- Hooks should complete in < 100ms but won't be killed until 60s

**Fix**: Clarify difference between performance budget and timeout

### HIGH #2: Hook Execution Model

**Documentation Implies**: Synchronous blocking

**Official Behavior**:
- Hooks run in separate process
- Claude Code waits for completion
- Exit code 2 blocks the action
- Exit code 0 allows continuation
- Hooks run in parallel for same event

**Fix**: Document parallel execution and exit code semantics

### HIGH #3: Missing Decision Control Types

**Documentation Shows**: Generic "decision" field

**Official Specification**:
- PreToolUse: `permissionDecision` ("allow", "deny", "ask")
- PostToolUse: `decision` ("block", undefined)
- Stop/SubagentStop: `decision` ("block", undefined)
- UserPromptSubmit: `decision` ("block", undefined)

**Fix**: Document event-specific decision fields

### HIGH #4: Transcript Access Pattern

**Current**: Assumes response is in hook input

**Official**: Must read transcript_path file to get response

**Example**:
```typescript
// Stop hook receives transcript_path, not response
const transcriptPath = hookData.transcript_path;
const transcript = fs.readFileSync(transcriptPath, 'utf8');
const lines = transcript.split('\n').filter(Boolean);
const lastMessage = JSON.parse(lines[lines.length - 1]);
const response = lastMessage.content; // Extract response
```

**Fix**: Add transcript parsing utilities

## Medium Priority Issues

### MEDIUM #1: Plugin Hooks

**Missing**: Documentation of plugin hook system

**Official Capability**: Plugins can provide hooks that merge with user hooks

**Fix**: Document plugin hook integration

### MEDIUM #2: Prompt-Based Hooks

**Missing**: "prompt" type hooks using LLM evaluation

**Official Capability**:
```json
{
  "type": "prompt",
  "prompt": "Evaluate if Claude should stop: $ARGUMENTS",
  "timeout": 30
}
```

**Fix**: Document prompt-based hooks for intelligent decisions

### MEDIUM #3: PermissionRequest Hook

**Missing**: PermissionRequest hook event documentation

**Use Case**: Auto-approve/deny permission requests

**Fix**: Add PermissionRequest hook examples

### MEDIUM #4: SessionStart Persistence

**Missing**: CLAUDE_ENV_FILE usage for env var persistence

**Example**:
```bash
#!/bin/bash
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
  echo 'export API_KEY=your-api-key' >> "$CLAUDE_ENV_FILE"
fi
```

**Fix**: Document env var persistence pattern

## Low Priority Issues

### LOW #1: MCP Tool Naming Pattern

**Missing**: MCP tool hook patterns

**Pattern**: `mcp__<server>__<tool>` (e.g., `mcp__memory__create_entities`)

**Fix**: Add MCP tool hook examples

### LOW #2: Deduplication Behavior

**Missing**: Hook deduplication documentation

**Official**: Multiple identical commands are deduplicated automatically

**Fix**: Mention deduplication behavior

### LOW #3: Security Best Practices

**Partial**: Basic security mentioned

**Official Guidance**:
- Validate and sanitize inputs
- Quote shell variables
- Block path traversal
- Use absolute paths
- Skip sensitive files

**Fix**: Expand security section

## Remediation Plan

### Phase 1: Critical Fixes (Immediate)

**Priority**: BLOCKER - Must fix before any implementation

1. **Update Hook Configuration Format** (2 hours)
   - Change all `.claude/hooks.json` references to `.claude/settings.json`
   - Update configuration structure to matcher/hooks array
   - Fix all example configurations

2. **Fix Hook Input/Output** (2 hours)
   - Add stdin reading pattern
   - Document official input schemas for all events
   - Add transcript parsing utilities
   - Document JSON output formats

3. **Document All Hook Events** (3 hours)
   - Add all 10 hook events
   - Provide use cases for each
   - Show example configurations
   - Document input/output schemas

4. **Fix Environment Variables** (1 hour)
   - Document CLAUDE_PROJECT_DIR usage
   - Add CLAUDE_ENV_FILE for SessionStart
   - Show CLAUDE_CODE_REMOTE detection

5. **Update Decision Control** (2 hours)
   - Document permissionDecision for PreToolUse
   - Show decision schemas for each event
   - Add updatedInput examples

**Total Effort**: 10 hours
**Completion Target**: Before any implementation work begins

### Phase 2: High Priority Fixes (Next)

**Priority**: HIGH - Fix during Phase 0 implementation

1. **Clarify Timeout vs Performance Budget** (1 hour)
2. **Document Parallel Execution** (1 hour)
3. **Add Transcript Access Pattern** (2 hours)
4. **Complete Decision Control Docs** (2 hours)

**Total Effort**: 6 hours
**Completion Target**: During Phase 0 (Foundation)

### Phase 3: Medium Priority Enhancements (Later)

**Priority**: MEDIUM - Add during implementation as needed

1. **Plugin Hooks Documentation** (2 hours)
2. **Prompt-Based Hooks** (2 hours)
3. **PermissionRequest Examples** (1 hour)
4. **SessionStart Persistence** (1 hour)

**Total Effort**: 6 hours
**Completion Target**: During Phase 1-2 (Event Capture)

### Phase 4: Low Priority Polish (Optional)

**Priority**: LOW - Nice to have

1. **MCP Tool Patterns** (1 hour)
2. **Deduplication Notes** (30 min)
3. **Expanded Security** (1 hour)

**Total Effort**: 2.5 hours
**Completion Target**: During documentation review

## Implementation Checklist

Before proceeding with implementation, verify:

- [ ] All hook configurations use `.claude/settings.json` format
- [ ] All hook scripts read from stdin, not argv
- [ ] All 10 hook events are documented
- [ ] Hook input schemas match official specification
- [ ] Stop hook reads transcript_path, not direct response
- [ ] Environment variables used correctly
- [ ] JSON output formats documented
- [ ] Exit code semantics understood
- [ ] Decision control types are event-specific
- [ ] Timeout vs performance budget clarified

## Updated Architecture

### Correct Hook Configuration

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/capture-prompt.js",
            "timeout": 100
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/capture-response.js",
            "timeout": 100
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/validate-write.js",
            "timeout": 100
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-init.js",
            "timeout": 100
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-cleanup.js",
            "timeout": 100
          }
        ]
      }
    ]
  }
}
```

### Correct Hook Implementation Pattern

```typescript
#!/usr/bin/env node

/**
 * UserPromptSubmit Hook
 * Captures user prompts from stdin
 */

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  try {
    // Read hook input from stdin
    const input = await readStdin();
    const hookData = JSON.parse(input);

    // Validate event type
    if (hookData.hook_event_name !== 'UserPromptSubmit') {
      console.error('Unexpected hook event:', hookData.hook_event_name);
      process.exit(1);
    }

    // Extract prompt
    const prompt = hookData.prompt;
    const sessionId = hookData.session_id;
    const transcriptPath = hookData.transcript_path;

    // Fire-and-forget event capture
    captureEvent({
      type: 'user_prompt',
      content: prompt,
      session_id: sessionId,
      transcript_path: transcriptPath
    }).catch(err => {
      console.error('[Hook Error]', err);
    });

    // Exit successfully (never block user)
    process.exit(0);

  } catch (error) {
    console.error('[Hook Critical Error]', error);
    process.exit(1);
  }
}

main();
```

### Correct Stop Hook Implementation

```typescript
#!/usr/bin/env node
import fs from 'fs';

/**
 * Stop Hook
 * Captures agent responses by reading transcript
 */

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function parseTranscript(transcriptPath: string): any[] {
  const content = fs.readFileSync(transcriptPath, 'utf8');
  return content.split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

async function main() {
  try {
    // Read hook input from stdin
    const input = await readStdin();
    const hookData = JSON.parse(input);

    // Read transcript to get response
    const transcript = parseTranscript(hookData.transcript_path);
    const lastMessage = transcript[transcript.length - 1];

    // Extract response content
    const response = lastMessage.content;

    // Fire-and-forget event capture
    captureEvent({
      type: 'agent_response',
      content: response,
      session_id: hookData.session_id,
      transcript_path: hookData.transcript_path
    }).catch(err => {
      console.error('[Hook Error]', err);
    });

    // Exit successfully
    process.exit(0);

  } catch (error) {
    console.error('[Hook Critical Error]', error);
    process.exit(1);
  }
}

main();
```

## Next Steps

1. **IMMEDIATE**: Review this remediation report
2. **IMMEDIATE**: Update all affected documentation files
3. **BEFORE IMPLEMENTATION**: Validate corrected architecture
4. **BEFORE IMPLEMENTATION**: Test hook configuration with Claude Code
5. **DURING PHASE 0**: Implement corrected hook scripts
6. **DURING PHASE 0**: Test with real Claude Code sessions

## References

- [Official Claude Code Hooks Reference](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [Official Claude Code Hooks Guide](https://docs.anthropic.com/en/docs/claude-code/hooks-guide)
- Repository Decision: `docs/decisions/decision-use-claude-hooks-2025-01-16.md`
- Repository Architecture: `docs/architecture/architecture-hooks-event-capture-2025-01-16.md`

## Conclusion

The repository's hook architecture has sound privacy-first principles and performance goals, but contains critical technical implementation errors that would prevent the system from working with Claude Code. All 6 critical issues must be resolved before proceeding with implementation.

**Estimated Remediation Effort**: 10 hours (Phase 1 critical fixes)

**Status After Remediation**: Ready for Phase 0 implementation

---

*Generated: 2025-01-17 by Claude Code Assistant*
*Priority: CRITICAL - BLOCKER for implementation*
