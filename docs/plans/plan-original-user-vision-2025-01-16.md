# Original User Vision - Global Context Network

> Capturing the user's original concept and requirements

---
title: Original User Vision for Global Context Network
category: plan
date: 2025-01-16
status: active
authors: Dennison (User) + Claude
tags: [vision, requirements, original-concept, blockchain, learning-network]
---

## User's Original Request

**Date**: 2025-01-16

### The Core Idea

*"I'm thinking about building a global context network for AI agents to learn from one another. Basically right now when I work through a project like when I'm doing a TypeScript development project there will be some sort of problem that I have to end up solving and working through with the agent. The learnings from this tend to just be lost to this specific project but I think it would be really interesting if these learnings could be shared with my other projects but also globally with everyone."*

### Unique Approach

*"It would be to use Claude Code hooks so to start with Claude Code so that before every prompt or before the LLM takes action we write to database my prompt and then when the LLM finishes action you know we write to the database everything that the LLM said and you know ideally all of their thinking processes and we do that for the entire conversation."*

### Privacy-First Design

*"There's a second step where another LLM takes out all the personally identifiable information so that's like API keys directories you know specific names of things so that we aren't leaking information and that could actually happen in the step before writing to the database just in case so we never have to worry about leaking data."*

### Decentralized Storage

*"Then we put that data on chain or we put it into IPFS and put a hash a pin of hash of it into the blockchain or we could put it into something like Celestia for example so it goes from the agent itself working through sanitation for private information into a database and then from a database into a global pool that's available for everyone."*

### Mining Through Learning

*"The process of providing it to this global pool would be sort of like a new-age version of cryptocurrency mining so by providing context to the pool you are effectively mining but you don't get the payout immediately because you could just stream junk from an LLM into this."*

### Validator Network

*"What we would have is validators there'd be a validator network which would be other agents who basically read this sort of context thread read this complete summary to digest learnings from it and decide whether or not this is a valid addition to the context pool."*

### Data Processing Pipeline

*"You have an agent that sanitizes the personal information before it goes into the database and then you have another agent that asynchronously summarizes the learnings of the process and then we store the learnings of the process into the global pool or maybe we store both."*

*"Then we have a validator network of agents which validate that this submission is good or you know contains good information or it seems valid basically it's like a eval running evals on this submitted data. You would need sort of like a quorum of agents to decide that it is valid and if it's valid then we distribute tokens out to the agent that provided it."*

### Query Interface

*"Now that information gets stored into the sort of global context database and we have a model context protocol server that agents can use when they start a process project where they can check this global database for learnings."*

*"So if you're familiar with context 7 which is basically database around docs this would essentially be like a database around learnings so we could share these learnings and effectively by doing that you are mining so you're providing learnings to the network and then the network is rewarding with tokens."*

## MVP Scope (User-Defined)

*"I would like to build an MVP of this and what I'm thinking of is hooks for Claude code that take both every prompt end prompt and then you know any context in between runs it through sanitization in a sub-agent probably with Claude code then stores it directly into a SQLite database."*

*"Then kicks off another async process so there's sort of like a queue of analyzing each chunk that comes in and you know updating an idea of the learnings that are going so that you know you don't have to remember you know you can close the window without losing all the learnings but each time you know you update there's some new learnings the learnings are stored in the database as well."*

*"And then after that it goes into another process async like a mining process it may be this like a miner that's running at the same time or just runs in the background because you were running in the first place and then that uploads it to the context Network."*

*"Then you have model context protocol which allows the ages to query that network and maybe potentially you know generate a key pair to collect funds."*

## Key Requirements Identified

### 1. Capture Layer
- ✅ Use Claude Code hooks
- ✅ Capture every user prompt (UserPromptSubmit)
- ✅ Capture every agent response (Stop)
- ✅ Include thinking processes if available
- ✅ Never block the user

### 2. Privacy Layer
- ✅ Sanitize BEFORE database storage
- ✅ Remove API keys
- ✅ Remove directory paths
- ✅ Remove specific names
- ✅ Use another agent for sanitization
- ✅ Never leak PII

### 3. Storage Layer
- ✅ SQLite database
- ✅ Store sanitized conversations
- ✅ Store extracted learnings
- ✅ Persist across window closes
- ✅ Queue-based processing

### 4. Learning Extraction
- ✅ Async processing
- ✅ Summarize learnings continuously
- ✅ Update as new chunks arrive
- ✅ Store learnings in database

### 5. Mining/Upload
- ✅ Background process
- ✅ Async upload to network
- ✅ IPFS or blockchain storage
- ✅ Token reward tracking

### 6. Query Interface
- ✅ Model Context Protocol server
- ✅ Allow agents to query learnings
- ✅ Key pair for fund collection
- ✅ Similar to Context7 for docs

### 7. Validator Network (Future)
- 🔮 Agent validators
- 🔮 Quality evaluation
- 🔮 Quorum-based validation
- 🔮 Token distribution on validation

## Design Principles Extracted

### Privacy-First
*"Sanitization happens before writing to database just in case so we never have to worry about leaking data."*

**Implementation**: Zero-trust PII handling with sanitization before storage.

### Async Everything
*"Kicks off another async process... a mining process... running in the background."*

**Implementation**: Job queue system with async workers for all processing.

### Never Lose Data
*"You can close the window without losing all the learnings."*

**Implementation**: Persistent queue and continuous learning extraction.

### Quality Through Validation
*"Validators... decide whether or not this is a valid addition."*

**Implementation**: Quality scoring and validator network (future).

### Incentive Alignment
*"By providing learnings to the network... the network is rewarding with tokens."*

**Implementation**: Token rewards for quality contributions.

## Evolution from Original Vision to MVP Plan

### What Stayed the Same
1. ✅ Claude Code hooks for capture
2. ✅ Sanitization before storage
3. ✅ SQLite database
4. ✅ Async processing
5. ✅ Learning extraction
6. ✅ MCP server interface
7. ✅ IPFS/blockchain upload

### What Was Enhanced
1. **Subagent-Driven Development**: All implementation via specialized subagents
2. **Claude Testing Harness**: Self-validating system using Claude Agent SDK
3. **Hybrid Sanitization**: Rule-based + AI for better accuracy
4. **Detailed Architecture**: 7-phase implementation plan with testable components
5. **Quality Gates**: Automated validation at every step

### What Was Deferred to Post-MVP
1. Validator network (quorum-based validation)
2. Multi-user support
3. Distributed storage
4. Complex token economics
5. Smart contract deployment

## Success Metrics (From User Intent)

### Functional Success
- ✅ Learnings captured from every conversation
- ✅ Zero PII leaks
- ✅ Learnings queryable via MCP
- ✅ Works across different projects
- ✅ Async processing doesn't block workflow

### User Experience Success
- ✅ Transparent to normal workflow
- ✅ No performance impact on Claude Code
- ✅ Easy to query learnings
- ✅ Learnings actually useful
- ✅ Trust in privacy guarantees

### Network Success (Future)
- 🔮 High-quality learnings contributed
- 🔮 Learnings validated by community
- 🔮 Token rewards distributed fairly
- 🔮 Network grows organically
- 🔮 Agents actively query network

## User's Vision for Impact

### Individual Developer Level
- Learn from own past experiences
- Share learnings across projects
- Build personal knowledge base
- Improve over time automatically

### Team Level
- Share learnings within organization
- Onboard new developers faster
- Standardize best practices
- Collective intelligence growth

### Global Level
- AI agents learn from each other
- Best practices emerge organically
- Problems solved once, shared globally
- Accelerate software development
- Democratize expert knowledge

## Key Insights from User

### Problem Statement
*"The learnings from this tend to just be lost to this specific project."*

**Solution**: Persistent storage and global sharing of learnings.

### Value Proposition
*"It would be really interesting if these learnings could be shared with my other projects but also globally with everyone."*

**Implementation**: MCP server for cross-project queries + global network for sharing.

### Trust Requirement
*"We never have to worry about leaking data."*

**Guarantee**: Sanitize BEFORE storage, never trust raw data.

### Quality Control
*"You could just stream junk from an LLM into this."*

**Solution**: Quality scoring + validator network + token incentives.

## Alignment with Claude Code Philosophy

The user's vision aligns perfectly with Claude Code's capabilities:

1. **Hooks System**: Native support for capturing events
2. **Subagent Support**: Built-in task delegation
3. **MCP Integration**: Standard protocol for tools
4. **File Access**: Can read/write for learning storage
5. **Bash Access**: Can run background processes

## Implementation Strategy

### Phase-Based Rollout

**Phases 0-3 (Weeks 1-3)**: Core Infrastructure
- Foundation, event capture, sanitization, storage
- **User Value**: Learnings saved locally, queryable

**Phases 4-6 (Weeks 4-6)**: Intelligence Layer
- Async processing, learning extraction, MCP server
- **User Value**: Quality learnings, cross-project queries

**Phase 7 (Week 6-7)**: Global Network
- IPFS upload, blockchain integration
- **User Value**: Share globally, earn rewards

### Post-MVP Enhancements

**Validator Network**:
- Multi-agent quality validation
- Quorum-based consensus
- Token distribution on validation

**Advanced Features**:
- Semantic search
- Learning recommendations
- Trend analysis
- Community curation

## Related Documents

### Architecture
- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Subagent System](../architecture/architecture-subagent-system-2025-01-16.md)
- [Sanitization Pipeline](../architecture/architecture-sanitization-pipeline-2025-01-16.md)

### Plans
- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md)
- [Global Context Network MVP](./plan-global-context-network-mvp-2025-01-16.md)

### Decisions
- [ADR: Use Claude Hooks](../decisions/decision-use-claude-hooks-2025-01-16.md)
- [ADR: Sanitize Before Storage](../decisions/decision-sanitize-before-storage-2025-01-16.md)

---

*This document preserves the user's original vision and requirements to ensure the implementation stays aligned with the core intent.*
