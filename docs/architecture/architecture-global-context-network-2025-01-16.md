# Global Context Network - System Architecture

> Complete system architecture for the Global Context Network MVP

---
title: Global Context Network System Architecture
category: architecture
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [architecture, system-design, blockchain, privacy, subagents]
---

## Overview

The Global Context Network is a decentralized system for capturing, sanitizing, storing, and sharing AI agent learnings globally. It enables agents to learn from each other's experiences while maintaining strict privacy guarantees through PII sanitization before storage.

### Core Innovation

**"Mining through Learning"**: Instead of computational mining, users contribute valuable learnings to the network and receive token rewards based on quality and validation.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Claude Code (User Agent)                         │
└────────────┬─────────────────────────────────────┬──────────────────────┘
             │                                      │
             ▼ UserPromptSubmit                    ▼ Stop
    ┌────────────────┐                    ┌───────────────┐
    │  Hook Handler  │                    │  Hook Handler │
    └────────┬───────┘                    └───────┬───────┘
             │                                      │
             └──────────────┬──────────────────────┘
                            ▼
                 ┌──────────────────────┐
                 │  Event Collector     │
                 │  (Captures events)   │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   Event Queue        │
                 │   (Persistent)       │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  Sanitization Queue  │
                 │  (Async Worker)      │
                 └──────────┬───────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │   Sanitization Pipeline     │
              │  ┌────────────────────────┐ │
              │  │ Rule-Based Detector    │ │
              │  │ (Regex, Fast)          │ │
              │  └──────────┬─────────────┘ │
              │             ▼                │
              │  ┌────────────────────────┐ │
              │  │ AI-Powered Sanitizer   │ │
              │  │ (Context-Aware)        │ │
              │  └──────────┬─────────────┘ │
              │             ▼                │
              │  ┌────────────────────────┐ │
              │  │ Hybrid Validator       │ │
              │  │ (Combine Results)      │ │
              │  └──────────┬─────────────┘ │
              └─────────────┼───────────────┘
                            │
                            ▼ SANITIZED DATA ONLY
                 ┌──────────────────────┐
                 │   SQLite Database    │
                 │  ┌────────────────┐  │
                 │  │ Conversations  │  │
                 │  │ Messages       │  │
                 │  │ Learnings      │  │
                 │  │ Job Queue      │  │
                 │  │ Uploads        │  │
                 │  └────────────────┘  │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Learning Extractor   │
                 │ (Async Worker)       │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  Quality Filter      │
                 │  (Score & Validate)  │
                 └──────────┬───────────┘
                            │
                            ├──────────────────┐
                            │                  │
                            ▼                  ▼
                 ┌──────────────────┐  ┌──────────────────┐
                 │   MCP Server     │  │  Mining Queue    │
                 │  (Query Access)  │  │  (Upload)        │
                 └──────────────────┘  └────────┬─────────┘
                            │                    │
                            │                    ▼
                            │         ┌──────────────────┐
                            │         │  IPFS Upload     │
                            │         └────────┬─────────┘
                            │                  │
                            │                  ▼
                            │         ┌──────────────────┐
                            │         │ Blockchain Tx    │
                            │         │ (Token Rewards)  │
                            │         └──────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   Agent Clients      │
                 │ (Query via MCP)      │
                 └──────────────────────┘
```

## Core Components

### 1. Event Capture Layer

**Purpose**: Capture Claude Code conversations without blocking the user

**Components**:
- **UserPromptSubmit Hook**: Captures user input
- **Stop Hook**: Captures agent responses
- **Event Collector**: Aggregates events into conversations
- **Event Queue**: Persists events (SQLite-based)

**Key Requirements**:
- Hook execution < 100ms
- Never block user interaction
- Fail silently with logging
- Persist events across restarts

### 2. Sanitization Pipeline

**Purpose**: Remove ALL PII before database storage

**Components**:
- **Rule-Based Detector**: Fast regex-based PII detection
- **AI Sanitizer**: Context-aware detection using LLM
- **Hybrid Validator**: Combines both approaches
- **Audit Logger**: Tracks what was redacted

**PII Categories**:
1. API Keys & Secrets
2. File Paths (absolute with usernames)
3. Email Addresses
4. IP Addresses
5. Names (person names, not variables)
6. Phone Numbers
7. URLs with tokens

**Critical Guarantee**: NEVER store raw data. Sanitization happens BEFORE database insert.

### 3. Storage Layer

**Purpose**: Persist sanitized conversations and learnings

**Database**: SQLite with migrations

**Tables**:
- `conversations`: Sanitized conversation metadata
- `messages`: Individual sanitized messages
- `learnings`: Extracted insights and patterns
- `job_queue`: Async job tracking
- `uploads`: Network upload status
- `sanitization_log`: Audit trail

**Design Principles**:
- ACID compliance
- Indexed for performance (queries < 100ms)
- Versioned migrations
- Transaction-based updates

### 4. Async Processing Layer

**Purpose**: Process jobs without blocking

**Components**:
- **Job Queue**: Persistent, priority-based queue
- **Workers**: Independent job processors
- **Retry Logic**: Exponential backoff
- **Error Handling**: Quarantine failed jobs

**Job Types**:
1. `sanitize_conversation`: Run sanitization pipeline
2. `extract_learning`: Generate learnings
3. `mine_upload`: Upload to network

### 5. Learning Extraction Layer

**Purpose**: Extract valuable, reusable learnings

**Components**:
- **Conversation Analyzer**: Determines if conversation has value
- **Category Extractors**: Specialized by learning type
- **Quality Scorer**: Assigns confidence scores
- **Deduplication**: Prevents duplicate learnings

**Learning Categories**:
- `pattern`: Code patterns and architectures
- `best_practice`: Recommended approaches
- `anti_pattern`: Things to avoid
- `bug_fix`: Problem-solving strategies
- `optimization`: Performance improvements
- `tool_usage`: How to use tools/libraries
- `workflow`: Development workflows
- `decision`: Architecture decisions

**Quality Requirements**:
- Confidence score ≥ 0.6
- Content length ≥ 100 characters
- Well-categorized with tags
- Not trivial or generic

### 6. Query Interface (MCP Server)

**Purpose**: Enable agents to query learnings

**Protocol**: Model Context Protocol (MCP)

**Tools**:
- `search_learnings`: Query by text, category, tags
- `get_learning_by_id`: Retrieve specific learning
- `get_learning_context`: Full conversation for learning

**Resources**:
- `context://learnings/recent`: Latest learnings
- `context://learnings/top-rated`: Highest confidence
- `context://stats`: Network statistics

**Performance**: All queries < 200ms

### 7. Network Layer

**Purpose**: Share learnings globally with rewards

**Components**:
- **IPFS Client**: Decentralized storage
- **Blockchain Integration**: Transaction handling
- **Token System**: Reward calculation
- **Validator Network**: Quality validation (future)

**Upload Process**:
1. Learning queued for upload
2. Content uploaded to IPFS → CID generated
3. Blockchain transaction with CID
4. Token reward calculated
5. Status tracked in uploads table

## Data Flow

### Happy Path: Conversation → Global Network

```
1. User interacts with Claude Code
   ↓
2. Hooks capture UserPromptSubmit + Stop events
   ↓
3. Events queued (< 100ms, non-blocking)
   ↓
4. Async worker picks up sanitization job
   ↓
5. Sanitization pipeline removes ALL PII
   ↓
6. Sanitized data stored in SQLite
   ↓
7. Learning extraction job queued
   ↓
8. Async worker extracts learnings
   ↓
9. Quality filter scores and filters learnings
   ↓
10. High-quality learnings queued for upload
   ↓
11. Mining worker uploads to IPFS
   ↓
12. Blockchain transaction records upload
   ↓
13. Token reward distributed
   ↓
14. Other agents query via MCP server
```

## Privacy Guarantees

### Zero-Trust PII Handling

**Rule 1**: Never store unsanitized data
**Rule 2**: Sanitize before database insertion
**Rule 3**: Audit all redactions
**Rule 4**: User control over uploads

### Sanitization Validation

**Rule-Based Layer** (Fast, Deterministic):
- Regex patterns for known PII formats
- < 1% false positive rate
- Processing time < 10ms

**AI Layer** (Accurate, Context-Aware):
- LLM-based context analysis
- Distinguishes names from variables
- Handles company-specific terminology
- < 5% false negative rate

**Hybrid Validation**:
- Rules catch obvious cases quickly
- AI validates and enhances
- Combined result sanitized
- Audit log tracks all detections

## Performance Requirements

| Component | Requirement | Rationale |
|-----------|-------------|-----------|
| Hook Execution | < 100ms | Never block user |
| Event Queueing | < 50ms | Fast persistence |
| Sanitization | < 2s per conversation | Acceptable async delay |
| Database Queries | < 100ms | Responsive queries |
| MCP Queries | < 200ms | Agent experience |
| Learning Extraction | < 5s per conversation | Background processing |

## Scalability Considerations

### Current (MVP)
- Single SQLite database
- Local processing
- File-based queue

### Future Scaling
- PostgreSQL for multi-user
- Distributed job queue (Redis)
- Horizontal worker scaling
- CDN for IPFS content
- Sharded blockchain integration

## Security Model

### Threat Model

**Threats Addressed**:
1. PII Leakage → Sanitization before storage
2. Unauthorized Access → Local-first architecture
3. Data Corruption → ACID transactions
4. Injection Attacks → Parameterized queries
5. Secret Exposure → Hook-level filtering

**Future Threats**:
1. Network Byzantine actors → Validator consensus
2. Spam/Junk learnings → Quality scoring + validation
3. Sybil attacks → Identity verification
4. Reward manipulation → Multi-validator consensus

### Access Control

**MVP**: Local-only access (single user)

**Future**:
- Multi-user authentication
- Role-based access control
- API key management for MCP
- Encrypted storage option

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js + TypeScript | Type safety, async-first |
| Database | SQLite | Simple, embedded, ACID |
| Testing | Vitest | Fast, modern, TypeScript-first |
| Sanitization | Regex + Claude API | Hybrid approach |
| MCP Server | @modelcontextprotocol/sdk | Standard protocol |
| Blockchain | TBD (Ethereum/Celestia) | EVM compatibility |
| Storage | IPFS | Decentralized, content-addressed |
| Queue | SQLite-based | Simple, persistent |

## Error Handling

### Graceful Degradation

**Hooks Fail**: Log error, don't block user
**Sanitization Fails**: Quarantine conversation, alert
**Learning Extraction Fails**: Mark for manual review
**Upload Fails**: Retry with exponential backoff
**MCP Query Fails**: Return empty with error message

### Recovery Strategies

1. **Job Retries**: Max 3 attempts with backoff
2. **Dead Letter Queue**: Failed jobs for analysis
3. **Manual Review**: Quarantine for complex cases
4. **Rollback**: Database migrations reversible
5. **Audit Trail**: Full logging for debugging

## Testing Strategy

### Test Pyramid

- **70% Unit Tests**: Isolated component testing
- **20% Integration Tests**: Component interactions
- **10% E2E Tests**: Full system workflows

### Critical Test Coverage

1. **Sanitization**: Zero PII leaks in 1000+ test cases
2. **Hooks**: Non-blocking, error handling
3. **Queue**: No job loss, proper ordering
4. **Database**: ACID compliance, concurrency
5. **MCP**: Protocol compliance, performance

### Claude-Powered Testing Harness

Uses Claude Agent SDK to:
- Generate comprehensive test suites
- Validate test quality
- Verify implementations
- Enforce quality gates

## Deployment Architecture

### MVP (Local Development)
```
User Machine:
  - Claude Code with hooks
  - SQLite database
  - Background workers
  - MCP server (local)
```

### Production (Future)
```
User Machines:
  - Claude Code with hooks
  - Local SQLite cache
  - MCP client

Cloud Infrastructure:
  - PostgreSQL cluster
  - Worker pool (auto-scaling)
  - MCP server (HA)
  - IPFS node/gateway
  - Blockchain node
```

## Integration Points

### Claude Code Hooks
- Configuration via `hooks.json`
- Scripts in `.claude/hooks/`
- Environment variables for paths

### MCP Protocol
- Standard MCP server implementation
- Claude Code auto-discovery
- Tool and resource definitions

### Blockchain
- Smart contract for rewards
- Event listening for confirmations
- Wallet integration for payouts

### IPFS
- Content upload via API
- CID generation and tracking
- Gateway for content retrieval

## Monitoring & Observability

### Key Metrics

**Performance**:
- Hook execution time
- Sanitization duration
- Query response time
- Job processing rate

**Quality**:
- PII detection rate
- Learning confidence scores
- Test coverage percentage
- Quality gate pass rate

**Business**:
- Conversations captured
- Learnings extracted
- Network uploads
- Token rewards distributed

### Logging Strategy

1. **Structured Logging**: JSON format
2. **Log Levels**: DEBUG, INFO, WARN, ERROR
3. **Correlation IDs**: Track conversation flow
4. **Audit Trail**: All PII redactions
5. **Performance Metrics**: Timing for all operations

## Related Documents

### Architecture
- [Subagent System](./architecture-subagent-system-2025-01-16.md)
- [Testing Harness](./architecture-testing-harness-2025-01-16.md)
- [Sanitization Pipeline](./architecture-sanitization-pipeline-2025-01-16.md)
- [Database Schema](./architecture-database-schema-2025-01-16.md)

### Decisions
- [ADR: Use Claude Hooks](../decisions/decision-use-claude-hooks-2025-01-16.md)
- [ADR: Sanitize Before Storage](../decisions/decision-sanitize-before-storage-2025-01-16.md)
- [ADR: Subagent-Driven Development](../decisions/decision-subagent-driven-development-2025-01-16.md)

### Plans
- [Implementation Roadmap](../plans/plan-implementation-roadmap-2025-01-16.md)
- [Original User Vision](../plans/plan-original-user-vision-2025-01-16.md)

### Reference
- [Database Schema Reference](../reference/reference-database-schema-2025-01-16.md)
- [Testing Strategy](../reference/reference-testing-strategy-2025-01-16.md)
