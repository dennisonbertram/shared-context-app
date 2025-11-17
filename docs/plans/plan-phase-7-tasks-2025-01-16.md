# Phase 7: Mining & Upload Tasks (MVP+)

> IPFS upload and blockchain integration with token tracking

---
title: Phase 7 Mining & Upload Tasks (MVP+)
category: plan
date: 2025-01-16
status: active
tags: [phase-7, ipfs, blockchain, mining, upload, mvp-plus]
---

## Goal

Upload quality learnings to IPFS and anchor CIDs on blockchain with token reward tracking.

## Duration

4-10 days (depending on blockchain complexity)

**Note**: This phase is marked as MVP+ and can be deferred or simplified for initial MVP release.

## Tasks

### IPFS Integration Decision
- [ ] Choose: self-hosted IPFS node vs pinning provider
- [ ] If provider: select service (Pinata, web3.storage, etc.)
- [ ] If self-hosted: set up IPFS node
- [ ] Configure pinning strategy and SLA
- [ ] Test IPFS node connectivity
- [ ] Document IPFS setup

**Acceptance**: IPFS endpoint available and tested

### IPFS Client Implementation
- [ ] Install IPFS client library
- [ ] Implement content upload function
- [ ] Implement CID generation
- [ ] Implement content retrieval (verify upload)
- [ ] Add retry logic for failed uploads
- [ ] Test upload/retrieval flow

**Subagent**: `ipfs-integration-agent`

**Acceptance**: Content uploads to IPFS and is retrievable

### Content Preparation
- [ ] Format learning for IPFS (JSON structure)
- [ ] Include metadata (category, tags, confidence, timestamp)
- [ ] Exclude any remaining sensitive data
- [ ] Add license information
- [ ] Add provenance data (sanitizer version, etc.)
- [ ] Compress content if needed

**Acceptance**: Content properly formatted for public sharing

### Blockchain Network Selection
- [ ] Choose blockchain (Ethereum testnet, Celestia, etc.)
- [ ] Set up RPC provider access
- [ ] Get testnet tokens from faucet
- [ ] Document network choice and rationale

**Acceptance**: Blockchain network decided and access configured

### Wallet & Key Management
- [ ] Implement local wallet generation
- [ ] Store keys securely (OS keychain)
- [ ] Implement backup/export functionality
- [ ] Add passphrase protection
- [ ] Document key management security
- [ ] Require explicit user action to enable

**Subagent**: `blockchain-agent`

**Acceptance**: Keys generated, stored securely, backupable

### CID Anchoring Strategy
- [ ] Decide: simple CID registry vs full smart contract
- [ ] If registry: implement off-chain registry with on-chain hashes
- [ ] If contract: design contract, deploy to testnet
- [ ] Implement transaction submission
- [ ] Implement confirmation polling
- [ ] Add gas estimation

**Acceptance**: CIDs anchored on-chain with confirmation

### Smart Contract (Optional - if time permits)
- [ ] Design learning registry contract
- [ ] Implement reward calculation logic
- [ ] Add quality score submission
- [ ] Deploy to testnet
- [ ] Audit contract (basic security review)
- [ ] Document contract interface

**Acceptance**: Contract deployed, tested, and documented

### Token Reward Tracking
- [ ] Implement reward calculation (placeholder or actual)
- [ ] Track upload status (pending, confirmed, rewarded)
- [ ] Store transaction IDs
- [ ] Query reward balance
- [ ] Document tokenomics (even if simplified)

**Acceptance**: Rewards tracked in database

### User Controls
- [ ] Implement opt-in for uploads (default off)
- [ ] Add manual approval gate before each upload
- [ ] Implement "local-only" mode
- [ ] Add upload pause/resume
- [ ] Document user privacy controls

**Acceptance**: User has full control over uploads

### Upload Verification
- [ ] Verify CID retrievable via 2+ IPFS gateways
- [ ] Verify on-chain record exists
- [ ] Verify N confirmed blocks
- [ ] Implement status monitoring
- [ ] Add failure alerts

**Acceptance**: Uploads verified across infrastructure

### Retry & Error Handling
- [ ] Implement retry for IPFS failures
- [ ] Implement retry for blockchain failures
- [ ] Handle insufficient gas scenarios
- [ ] Handle rate limiting
- [ ] Add exponential backoff
- [ ] Move to DLQ after max retries

**Acceptance**: Failures handled gracefully with retries

## Dependencies

- Phase 5: Quality learnings to upload

## Deliverables

1. IPFS client integration
2. Blockchain integration
3. Wallet/key management system
4. CID anchoring implementation
5. Token reward tracking
6. User control interface
7. Upload verification system

## Success Criteria

- ✅ Content uploads to IPFS successfully
- ✅ CID retrievable via 2+ gateways
- ✅ On-chain record confirmed (N blocks)
- ✅ Keys stored securely (OS keychain)
- ✅ Manual approval gate working
- ✅ User controls for opt-in/out
- ✅ Retry logic handles failures

## MVP Simplification Options

If timeline is tight, simplify Phase 7 to:

### Minimal MVP+
- IPFS upload only (via pinning provider)
- Off-chain CID registry (no blockchain)
- Placeholder token tracking
- Defer smart contracts to post-MVP

### Core MVP (No Phase 7)
- Skip network upload entirely
- Focus on local capture, sanitization, learning extraction, MCP
- Add Phase 7 in Month 2

## Testing Strategy

- Integration tests for IPFS upload/retrieval
- Integration tests for blockchain transactions
- Security tests for key management
- Chaos tests (IPFS unavailable, blockchain RPC down)
- Manual approval flow tests
- Retry logic tests

## Related Documents

- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md)
- [Original User Vision](./plan-original-user-vision-2025-01-16.md)
