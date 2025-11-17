# Phase 2: Sanitization Pipeline Tasks

> PII detection and removal with rule-based + AI hybrid approach

---
title: Phase 2 Sanitization Pipeline Tasks
category: plan
date: 2025-01-16
status: active
tags: [phase-2, sanitization, pii, privacy, security]
---

## Goal

Remove ALL PII before final database storage using hybrid sanitization (rules + AI) with measurable precision/recall metrics.

## Duration

7-10 days (includes gold dataset creation)

## Tasks

### Gold Dataset Creation
- [ ] Build or adopt labeled PII dataset (1000+ examples)
- [ ] Include categories: email, phone, IP, path, key, URL, JWT, name
- [ ] Cover multiple OS path patterns (macOS, Linux, Windows)
- [ ] Include international formats (phone, addresses)
- [ ] Include adversarial examples (bypass attempts)
- [ ] Label each example with PII type

**Subagent**: `dataset-builder-agent`

**Acceptance**: 1000+ labeled examples across 8+ PII categories

### Rule-Based PII Detector
- [ ] Implement regex patterns for emails
- [ ] Implement regex for phone numbers (multiple formats)
- [ ] Implement regex for IPv4 and IPv6 addresses
- [ ] Implement regex for file paths (OS-specific patterns)
- [ ] Implement regex for API keys (AWS, GCP, OpenAI, GitHub, Slack)
- [ ] Implement regex for JWTs and URL tokens
- [ ] Implement regex for common environment variable patterns
- [ ] Define redaction format: [REDACTED_EMAIL], [REDACTED_PATH], etc.
- [ ] Optimize for < 10ms execution

**Subagent**: `rule-sanitizer-agent`

**Acceptance**:
- Precision ≥ 98% per category on gold dataset
- Execution < 10ms for typical payloads

### AI-Powered Sanitizer
- [ ] Integrate Claude API for context-aware sanitization
- [ ] Define prompt templates (temperature=0 for determinism)
- [ ] Implement fallback to rules-only if API unavailable
- [ ] Distinguish names from variable names
- [ ] Handle company-specific terminology
- [ ] Set max tokens and timeout limits
- [ ] Cache API responses for identical inputs

**Subagent**: `ai-sanitizer-agent`

**Acceptance**:
- Recall ≥ 95% per category on gold dataset
- Handles context ambiguity
- Fallback working

### Hybrid Validation Pipeline
- [ ] Combine rule-based + AI results
- [ ] Implement consensus logic (union of redactions)
- [ ] Create audit log of all redactions
- [ ] Track which method detected each PII item
- [ ] Implement override mechanism for false positives
- [ ] Ensure deterministic output

**Subagent**: `sanitization-pipeline-agent`

**Acceptance**: Combined precision ≥ 98%, recall ≥ 95%

### Scoring Harness
- [ ] Implement precision calculation per PII category
- [ ] Implement recall calculation per PII category
- [ ] Implement F1 score per category
- [ ] Generate per-category reports
- [ ] Set acceptance thresholds per category
- [ ] Create continuous evaluation suite

**Acceptance**: Automated scoring against gold dataset

### Chain-of-Thought Exclusion
- [ ] Identify and exclude chain-of-thought from all storage
- [ ] Document policy: never store thinking processes
- [ ] Implement detection of thinking tags
- [ ] Test exclusion is complete
- [ ] Update schema to not include thinking fields

**Acceptance**: Zero chain-of-thought stored

### Adversarial Testing
- [ ] Create adversarial test suite (prompt injection, evasion)
- [ ] Test obfuscated PII (base64, hex, URL-encoded)
- [ ] Test context manipulation attempts
- [ ] Test delimiter confusion
- [ ] Document vulnerabilities found

**Acceptance**: Adversarial suite passes, vulnerabilities documented

### Logging Redaction
- [ ] Implement log redaction middleware
- [ ] Ensure no PII in debug/error logs
- [ ] Test log output for PII leaks
- [ ] Document safe logging practices

**Acceptance**: No PII in any log outputs

## Dependencies

- Phase 1: Events to sanitize

## Deliverables

1. Gold PII dataset (1000+ labeled examples)
2. Rule-based sanitizer with 20+ patterns
3. AI-powered sanitizer with prompt templates
4. Hybrid pipeline orchestrator
5. Scoring harness with per-category metrics
6. Adversarial test suite
7. Audit logging system

## Success Criteria

- ✅ Precision ≥ 98% per PII category
- ✅ Recall ≥ 95% per PII category
- ✅ Sanitization < 2s per conversation
- ✅ No plaintext raw data on disk (pre-sanitized before persistence)
- ✅ Chain-of-thought excluded from all storage
- ✅ Audit log tracking all redactions
- ✅ Adversarial test suite passes
- ✅ No PII in logs

## PII Categories Covered

1. **Emails**: Standard formats, obfuscated variants
2. **Phone Numbers**: US, international, with/without formatting
3. **IP Addresses**: IPv4, IPv6, with ports
4. **File Paths**: Absolute paths with usernames (all OSes)
5. **API Keys**: AWS, GCP, OpenAI, GitHub, Slack, generic patterns
6. **URLs with Tokens**: Query params, bearer tokens, JWTs
7. **Environment Variables**: With secret values
8. **Names**: Person names (context-aware, not variable names)

## Testing Strategy

- Unit tests for each regex pattern
- Unit tests for AI sanitizer with mocked API
- Integration tests for hybrid pipeline
- Performance tests (< 2s per conversation)
- Precision/recall tests against gold dataset
- Adversarial tests for evasion attempts
- Chaos tests (API unavailable, rate limited)

## Related Documents

- [Sanitization Pipeline Architecture](../architecture/architecture-sanitization-pipeline-2025-01-16.md)
- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md)
- [Privacy ADR](../decisions/decision-sanitize-before-storage-2025-01-16.md)
