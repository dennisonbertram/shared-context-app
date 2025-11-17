---
title: ADR-011: Signing, Attestations, and Provenance for Published Learnings
category: decision
date: 2025-01-16
status: draft
deciders: Claude + Dennison
tags: [security, signing, provenance, attestations, trust, integrity]
---

# ADR-011: Signing, Attestations, and Provenance for Published Learnings

## Status

Accepted (Revised after GPT-5 Review)

Date: 2025-01-16
Review Date: 2025-01-16

## Context

The Global Context Network enables users to publish sanitized learnings to a distributed network (IPFS + blockchain) for global consumption. These learnings will be:

1. **Consumed by unknown parties** - Downloaded and used by AI agents worldwide
2. **Trusted as knowledge** - Integrated into agent context and decision-making
3. **Potentially high-impact** - Could influence critical workflows or decisions
4. **Subject to tampering** - IPFS content is immutable, but metadata/indexing can be manipulated
5. **Attributed to publishers** - Users need reputation and accountability

**The Trust Problem**: Without signing and provenance, consumers have no way to:
- Verify learnings came from the claimed publisher
- Detect tampering during transmission or storage
- Validate sanitization was performed correctly
- Trust the tooling versions used for extraction
- Build reputation systems or trust networks
- Audit the chain of custody from capture → sanitization → extraction → upload

**Real-World Attack Scenarios**:
- **Malicious injection**: Attacker uploads poisoned learnings claiming to be from trusted publisher
- **Metadata manipulation**: Blockchain metadata altered to point to malicious IPFS content
- **Sanitization bypass**: Learning uploaded without proper PII removal
- **Version mismatch**: Learning extracted with buggy/vulnerable extractor version
- **Replay attacks**: Old, outdated learnings re-uploaded as new
- **Reputation hijacking**: Attacker impersonates high-reputation publisher

**Current State**: MVP lacks any signing or attestation mechanism. Uploads are anonymous and unverifiable.

**External Review Recommendation**: GPT-5 holistic review (2025-01-16) specifically recommended an ADR for signing, attestations, and provenance to establish trust in the global network.

## Decision

Implement cryptographic signing and attestation system for all published learnings with per-device key management.

### Core Components

#### 1. Per-Device Signing Keys

**Key Generation**:
- Each device/installation generates an Ed25519 keypair on first run
- Private key stored securely in OS-native keychain
- Public key becomes the device's publishing identity
- Optional: User can link multiple devices to same identity (future)

**Key Storage**:
```typescript
interface KeyStorage {
  // OS-native secure storage
  platform: "macos-keychain" | "windows-dpapi" | "linux-keyring";

  // Keychain attributes
  service: "global-context-network";
  account: string; // deviceId or user-chosen identity

  // Private key encrypted by OS
  privateKey: Uint8Array; // Ed25519 private key (32 bytes)
}
```

**Platform-Specific Implementation**:
- **macOS**: Keychain Services API (`security add-generic-password`)
- **Windows**: DPAPI (Data Protection API) via node `dpapi` module
- **Linux**: Secret Service API (Freedesktop.org) via `libsecret` or `gnome-keyring`

**Fallback**: If OS keychain unavailable, use encrypted file with user-provided password (warn about security implications).

#### 2. Signature Format

Every published learning includes:

```typescript
interface SignedLearning {
  // Core content
  learning: {
    id: string;              // ULID
    content: string;         // Sanitized markdown
    tags: string[];
    category: string;
    extractedAt: string;     // ISO-8601
  };

  // Provenance metadata (sourceConversationId EXCLUDED for privacy)
  provenance: {
    sanitizerVersion: string;      // "rules-v1.2+ai-v2.0"
    extractorVersion: string;      // "learning-extractor-v1.0"
    claudeCodeVersion: string;     // "1.2.3"
    timestamp: string;             // ISO-8601 signing time (SINGLE SOURCE OF TRUTH)
    toolchainCommitSha: string;    // Git commit of sanitizer/extractor
    lockfileHash: string;          // Hash of package-lock.json for reproducibility
    nodeVersion: string;           // Node.js runtime version
  };

  // Consent and licensing (required per STANDARDS)
  consent: {
    license: string;               // "CC-BY-4.0" or "ODC-By"
    consentType: string;           // "explicit" | "implicit"
  };

  // Attestations
  attestations: {
    sanitizationEvidence: {
      rulesVersion: string;        // "v1.2"
      aiModelVersion: string;      // "claude-3.5-sonnet-20250115"
      detectionsByCategory: Record<string, number>; // { EMAIL: 2, API_KEY: 1 }
      totalDetections: number;     // Total PII items redacted
      confidence: number;          // 0-1 sanitization confidence
      auditPassed: boolean;        // Post-ingest audit passed
      sanitizationLogMerkleRoot: string; // Merkle root of sanitization log entries
    };

    extractionEvidence: {
      modelVersion: string;        // "claude-3.5-sonnet-20250115"
      promptVersion: string;       // "learning-extractor-v1.0"
      temperature: number;         // 0.0-1.0
      reviewStatus: string;        // "auto" | "reviewed" | "approved"
    };

    // Integrity checks (EXCLUDED from metadataHash computation to avoid circularity)
    integrityChecks: {
      contentHash: string;         // SHA-256 of learning.content
      metadataHash: string;        // SHA-256 of RFC 8785 canonical JSON (provenance + consent + attestations WITHOUT integrityChecks)
    };
  };

  // Cryptographic signature
  signature: {
    algorithm: "ed25519";          // Fixed for MVP (enables algorithm agility)
    hashAlgorithm: "sha256";       // Hash function used (SHA-256)
    canonicalization: "rfc8785";   // RFC 8785 canonical JSON (prevents malleability)
    publicKey: string;             // Ed25519 public key (32 bytes, base64url encoded)
    signatureValue: string;        // Ed25519 signature (64 bytes, base64url encoded)
    keyId: string;                 // Stable key ID: "ed25519:base64url(sha256(publicKey))"
    schemaVersion: "1";            // Schema version for migrations
  };
}

/**
 * CRITICAL DESIGN NOTES (per GPT-5 review):
 *
 * 1. Metadata Hash Circularity Prevention:
 *    - metadataHash is computed EXCLUDING integrityChecks
 *    - metadataBody = { provenance, consent, attestations WITHOUT integrityChecks }
 *
 * 2. Single Timestamp Source of Truth:
 *    - ONE timestamp (provenance.timestamp) used in both signing and verification
 *    - Avoid creating separate timestamps in signingPayload
 *
 * 3. Canonical JSON Throughout:
 *    - ALL hashing and signing uses RFC 8785 canonicalize()
 *    - NEVER use JSON.stringify() for cryptographic operations
 *
 * 4. UTF-8 Encoding:
 *    - Sign UTF-8 bytes of canonical JSON, not strings
 *    - Use TextEncoder().encode(canonicalJSON(payload))
 *
 * 5. Privacy Protection:
 *    - sourceConversationId is EXCLUDED from published artifact
 *    - deviceId is EXCLUDED or made clearly pseudonymous
 */
```

**Signing Process** (Fixed per GPT-5 Review):
```typescript
import canonicalize from 'canonicalize'; // RFC 8785 canonical JSON
import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';

async function signLearning(learning: Learning): Promise<SignedLearning> {
  // 1. Load private key from OS keychain (using keytar, NOT CLI)
  const privateKey = await loadPrivateKey();
  const publicKey = await ed.getPublicKey(privateKey);

  // 2. Build provenance metadata with SINGLE timestamp (SOURCE OF TRUTH)
  const timestamp = new Date().toISOString(); // ISO-8601
  const provenance = {
    sanitizerVersion: SANITIZATION_VERSION,
    extractorVersion: LEARNING_EXTRACTOR_VERSION,
    claudeCodeVersion: CLAUDE_CODE_VERSION,
    timestamp, // CRITICAL: This timestamp used everywhere (signing, verification)
    toolchainCommitSha: await getGitCommitSha(),
    lockfileHash: await getLockfileHash(),
    nodeVersion: process.version
  };

  // 3. Build attestations WITHOUT integrityChecks (avoid circularity)
  const attestations = await buildAttestations(learning);

  // 4. Build consent object (required per STANDARDS.md)
  const consent = {
    license: "CC-BY-4.0",
    consentType: "explicit" as const
  };

  // 5. Compute content hash (SHA-256 of UTF-8 bytes)
  const contentHash = bytesToHex(sha256(new TextEncoder().encode(learning.content)));

  // 6. Build metadata body (EXCLUDING integrityChecks to avoid circularity)
  const metadataBody = {
    provenance,
    consent,
    attestations: {
      sanitizationEvidence: attestations.sanitizationEvidence,
      extractionEvidence: attestations.extractionEvidence
      // CRITICAL: integrityChecks NOT included - would create circular dependency
    }
  };

  // 7. Compute metadata hash using RFC 8785 canonical JSON
  const canonicalMetadata = canonicalize(metadataBody);
  if (!canonicalMetadata) throw new Error('Failed to canonicalize metadata');

  const metadataHash = bytesToHex(
    sha256(new TextEncoder().encode(canonicalMetadata))
  );

  // 8. Derive key ID (stable, derivable identifier)
  const keyId = "ed25519:" + bytesToBase64Url(sha256(publicKey));

  // 9. Create canonical signing payload with domain separation
  const signingPayload = {
    context: "gcn.signedlearning.v1", // Domain separation (prevents cross-protocol replay)
    schemaVersion: "1",                // Schema versioning for migrations
    hashAlgorithm: "sha256",           // Explicitly document hash algorithm
    canonicalization: "rfc8785",       // Explicitly document canonicalization
    learningId: learning.id,           // ULID
    contentHash,                       // SHA-256 hex
    metadataHash,                      // SHA-256 hex
    timestamp: provenance.timestamp,   // CRITICAL: Use SAME timestamp (not new Date())
    keyId                              // Stable key identifier
  };

  // 10. Sign the UTF-8 bytes of RFC 8785 canonical JSON
  const canonicalPayload = canonicalize(signingPayload);
  if (!canonicalPayload) throw new Error('Failed to canonicalize signing payload');

  const payloadBytes = new TextEncoder().encode(canonicalPayload);
  const signatureValue = await ed.sign(payloadBytes, privateKey);

  // 11. Construct signed learning (integrityChecks added AFTER hashing)
  return {
    learning,
    provenance,
    consent,
    attestations: {
      sanitizationEvidence: attestations.sanitizationEvidence,
      extractionEvidence: attestations.extractionEvidence,
      integrityChecks: { contentHash, metadataHash } // Added AFTER metadataHash computation
    },
    signature: {
      algorithm: "ed25519",
      hashAlgorithm: "sha256",
      canonicalization: "rfc8785",
      publicKey: bytesToBase64Url(publicKey),           // 32 bytes base64url
      signatureValue: bytesToBase64Url(signatureValue), // 64 bytes base64url
      keyId,
      schemaVersion: "1"
    }
  };
}

// Helper functions
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(base64, 'base64'));
}
```

**Verification Process** (Fixed per GPT-5 Review):
```typescript
async function verifyLearning(signed: SignedLearning): Promise<VerificationResult> {
  // 1. Recompute content hash (SHA-256 of UTF-8 bytes)
  const contentHash = bytesToHex(
    sha256(new TextEncoder().encode(signed.learning.content))
  );

  // 2. Verify content hash matches (detect content tampering)
  if (contentHash !== signed.attestations.integrityChecks.contentHash) {
    return { valid: false, reason: "Content hash mismatch - content tampered" };
  }

  // 3. Rebuild metadata body (EXCLUDING integrityChecks - same as signing)
  const metadataBody = {
    provenance: signed.provenance,
    consent: signed.consent,
    attestations: {
      sanitizationEvidence: signed.attestations.sanitizationEvidence,
      extractionEvidence: signed.attestations.extractionEvidence
      // CRITICAL: integrityChecks NOT included - matches signing logic
    }
  };

  // 4. Recompute metadata hash using RFC 8785 canonical JSON
  const canonicalMetadata = canonicalize(metadataBody);
  if (!canonicalMetadata) {
    return { valid: false, reason: "Failed to canonicalize metadata for verification" };
  }

  const metadataHash = bytesToHex(
    sha256(new TextEncoder().encode(canonicalMetadata))
  );

  // 5. Verify metadata hash matches (detect metadata tampering)
  if (metadataHash !== signed.attestations.integrityChecks.metadataHash) {
    return { valid: false, reason: "Metadata hash mismatch - metadata tampered" };
  }

  // 6. Reconstruct signing payload (EXACTLY as in signing process)
  const signingPayload = {
    context: "gcn.signedlearning.v1",              // Domain separation
    schemaVersion: signed.signature.schemaVersion, // Schema version
    hashAlgorithm: signed.signature.hashAlgorithm, // "sha256"
    canonicalization: signed.signature.canonicalization, // "rfc8785"
    learningId: signed.learning.id,                // ULID
    contentHash,                                   // Recomputed
    metadataHash,                                  // Recomputed
    timestamp: signed.provenance.timestamp,        // CRITICAL: Use SAME timestamp from provenance
    keyId: signed.signature.keyId                  // Key identifier
  };

  // 7. Verify Ed25519 signature on UTF-8 bytes of RFC 8785 canonical JSON
  const canonicalPayload = canonicalize(signingPayload);
  if (!canonicalPayload) {
    return { valid: false, reason: "Failed to canonicalize signing payload for verification" };
  }

  const payloadBytes = new TextEncoder().encode(canonicalPayload);
  const publicKeyBytes = base64UrlToBytes(signed.signature.publicKey);
  const signatureBytes = base64UrlToBytes(signed.signature.signatureValue);

  const signatureValid = await ed.verify(signatureBytes, payloadBytes, publicKeyBytes);

  if (!signatureValid) {
    return { valid: false, reason: "Invalid Ed25519 signature - not signed by claimed key" };
  }

  // 8. Verify key ID matches public key (detect public key substitution)
  const derivedKeyId = "ed25519:" + bytesToBase64Url(sha256(publicKeyBytes));
  if (derivedKeyId !== signed.signature.keyId) {
    return { valid: false, reason: "Key ID mismatch - public key altered" };
  }

  // 9. Verify timestamp freshness (optional policy - configurable)
  const signedAt = new Date(signed.provenance.timestamp);
  const age = Date.now() - signedAt.getTime();
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  if (age > MAX_AGE_MS) {
    return { valid: true, warning: "Signature older than 30 days" };
  }

  // 10. Verify consent/license is present (required per STANDARDS.md)
  if (!signed.consent || !signed.consent.license) {
    return { valid: true, warning: "Missing license information (STANDARDS violation)" };
  }

  // 11. Verify algorithm support (reject unknown algorithms)
  if (signed.signature.algorithm !== "ed25519") {
    return { valid: false, reason: `Unsupported signature algorithm: ${signed.signature.algorithm}` };
  }

  if (signed.signature.hashAlgorithm !== "sha256") {
    return { valid: false, reason: `Unsupported hash algorithm: ${signed.signature.hashAlgorithm}` };
  }

  return { valid: true };
}
```

#### 3. On-Chain Provenance Registry

**Blockchain Smart Contract** (Fixed per GPT-5 Review):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LearningRegistry
 * @notice On-chain registry for signed learnings with Ed25519 public keys
 * @dev Ed25519 signature verification happens OFF-CHAIN (no EVM precompile)
 *      Contract stores hashes and metadata for integrity verification
 *      Publisher uses separate EVM key for transactions
 */
contract LearningRegistry {
  struct LearningRecord {
    bytes32 contentHash;      // SHA-256 of learning content
    bytes32 metadataHash;     // SHA-256 of metadata (provenance + attestations)
    address publisher;        // EVM address (tx signer, NOT derived from Ed25519)
    bytes ipfsCid;            // IPFS CID (multihash encoded, or use string for readability)
    uint256 timestamp;        // block.timestamp (authoritative)
    bytes publicKey;          // Ed25519 public key (32 bytes) for off-chain verification
    bytes32 keyId;            // sha256(publicKey) for key rotation tracking
    uint8 schemaVersion;      // Schema version (1 for MVP)
  }

  // ULID stored as bytes16 (128 bits)
  mapping(bytes16 => LearningRecord) public learnings;

  // Publisher reputation (EVM address -> score)
  mapping(address => uint256) public reputationScores;

  // Key ID to publisher mapping (for key rotation)
  mapping(bytes32 => address) public keyIdToPublisher;

  // Per-publisher nonce for replay protection
  mapping(address => uint256) public publisherNonces;

  event LearningPublished(
    bytes16 indexed learningId,
    address indexed publisher,
    bytes32 indexed keyId,
    bytes ipfsCid,
    bytes32 contentHash,
    bytes32 metadataHash,
    uint256 nonce
  );

  event PublisherRegistered(
    address indexed publisher,
    bytes32 indexed keyId,
    bytes publicKey
  );

  /**
   * @notice Publish a signed learning to the registry
   * @param learningId ULID as bytes16 (128 bits)
   * @param contentHash SHA-256 hash of learning content
   * @param metadataHash SHA-256 hash of metadata
   * @param ipfsCid IPFS content identifier (bytes or string)
   * @param publicKey Ed25519 public key (32 bytes)
   * @dev Signature verification happens OFF-CHAIN by consumers
   */
  function publishLearning(
    bytes16 learningId,
    bytes32 contentHash,
    bytes32 metadataHash,
    bytes calldata ipfsCid,
    bytes calldata publicKey
  ) external {
    require(publicKey.length == 32, "Invalid Ed25519 public key length");
    require(learnings[learningId].timestamp == 0, "Already published");

    // Derive key ID
    bytes32 keyId = sha256(publicKey);

    // Register publisher-key association (first time)
    if (keyIdToPublisher[keyId] == address(0)) {
      keyIdToPublisher[keyId] = msg.sender;
      emit PublisherRegistered(msg.sender, keyId, publicKey);
    } else {
      require(keyIdToPublisher[keyId] == msg.sender, "Key ID already claimed");
    }

    // Get publisher nonce
    uint256 nonce = publisherNonces[msg.sender];
    publisherNonces[msg.sender]++;

    // Store learning record
    learnings[learningId] = LearningRecord({
      contentHash: contentHash,
      metadataHash: metadataHash,
      publisher: msg.sender,
      ipfsCid: ipfsCid,
      timestamp: block.timestamp,
      publicKey: publicKey,
      keyId: keyId,
      schemaVersion: 1
    });

    emit LearningPublished(
      learningId,
      msg.sender,
      keyId,
      ipfsCid,
      contentHash,
      metadataHash,
      nonce
    );
  }

  /**
   * @notice Verify learning hashes match on-chain record
   * @param learningId ULID as bytes16
   * @param providedContentHash Content hash to verify
   * @param providedMetadataHash Metadata hash to verify
   * @return True if hashes match and record exists
   */
  function verifyLearning(
    bytes16 learningId,
    bytes32 providedContentHash,
    bytes32 providedMetadataHash
  ) external view returns (bool) {
    LearningRecord memory record = learnings[learningId];
    return
      record.timestamp > 0 &&
      record.contentHash == providedContentHash &&
      record.metadataHash == providedMetadataHash;
  }

  /**
   * @notice Get full learning record
   * @param learningId ULID as bytes16
   */
  function getLearning(bytes16 learningId)
    external
    view
    returns (LearningRecord memory)
  {
    return learnings[learningId];
  }
}
```

**Key Design Decisions** (Hybrid Approach per GPT-5 Review):
- **Separate keys**: Ed25519 for content signing (off-chain), separate secp256k1/EVM key for transactions
  - CRITICAL: Cannot derive EVM address from Ed25519 key (different elliptic curves)
  - Publisher uses their EVM wallet (MetaMask, etc.) to submit transactions
  - Ed25519 public key stored on-chain for verification reference
- **Off-chain signature verification**: Consumers verify Ed25519 signatures using IPFS content, NOT on-chain
  - No Ed25519 EVM precompile exists (would be too expensive anyway)
  - Contract stores hashes and public key for integrity verification
- **On-chain integrity anchoring**: Contract stores contentHash, metadataHash, and Ed25519 public key
- **Key-to-publisher binding**: First EVM address to use a keyId owns it (prevents impersonation)
- **Nonce for replay protection**: Per-publisher nonce prevents replay attacks
- **ULID encoding**: bytes16 (128 bits) for gas efficiency

**Integration with Upload Flow** (Fixed per GPT-5 Review):
```typescript
async function uploadSignedLearning(signed: SignedLearning) {
  // 1. Upload to IPFS (full signed learning JSON)
  const ipfsCid = await ipfs.add(JSON.stringify(signed));

  // 2. Get user's EVM wallet (SEPARATE from Ed25519 signing key)
  // User must connect wallet (MetaMask, WalletConnect, etc.)
  const evmWallet = await getConnectedEVMWallet(); // secp256k1 key
  const publisherAddress = await evmWallet.getAddress();

  // 3. Convert ULID to bytes16 for Solidity
  const learningIdBytes16 = ulidToBytes16(signed.learning.id);

  // 4. Convert hashes to bytes32
  const contentHashBytes32 = hexToBytes32(signed.attestations.integrityChecks.contentHash);
  const metadataHashBytes32 = hexToBytes32(signed.attestations.integrityChecks.metadataHash);

  // 5. Convert IPFS CID to bytes (multihash encoding)
  const ipfsCidBytes = cidToBytes(ipfsCid);

  // 6. Decode Ed25519 public key from base64url
  const publicKeyBytes = base64UrlToBytes(signed.signature.publicKey); // 32 bytes

  // 7. Register on blockchain (signed by EVM key, stores Ed25519 pubkey)
  const tx = await learningRegistry.publishLearning(
    learningIdBytes16,
    contentHashBytes32,
    metadataHashBytes32,
    ipfsCidBytes,
    publicKeyBytes
  );

  await tx.wait();

  // 8. Store upload record
  await db.uploads.insert({
    learningId: signed.learning.id,
    ipfsCid,
    blockchainTxHash: tx.hash,
    evmPublisher: publisherAddress,           // EVM address (tx signer)
    ed25519PublicKey: signed.signature.publicKey, // Ed25519 pubkey (content signer)
    uploadedAt: new Date().toISOString()
  });
}
```

#### 4. Attestation Generation

**Sanitization Evidence**:
```typescript
async function buildSanitizationEvidence(
  conversationId: string
): Promise<SanitizationEvidence> {
  // Query sanitization log for this conversation
  const sanitizationRecords = await db.sanitizationLog.findMany({
    conversationId
  });

  // Aggregate evidence
  const totalDetections = sanitizationRecords.reduce(
    (sum, r) => sum + r.detectionsCount,
    0
  );

  const avgConfidence = sanitizationRecords.reduce(
    (sum, r) => sum + r.confidence,
    0
  ) / sanitizationRecords.length;

  // Check if post-ingest audit passed
  const auditPassed = await checkAuditStatus(conversationId);

  return {
    rulesVersion: SANITIZATION_RULES_VERSION,
    aiModelVersion: SANITIZATION_AI_MODEL,
    detectionsCount: totalDetections,
    confidence: avgConfidence,
    auditPassed
  };
}
```

**Extraction Evidence**:
```typescript
async function buildExtractionEvidence(
  learningId: string
): Promise<ExtractionEvidence> {
  // Query job queue for extraction job
  const job = await db.jobQueue.findOne({
    type: 'extract_learning',
    targetId: learningId
  });

  return {
    modelVersion: job.modelVersion || LEARNING_EXTRACTOR_MODEL,
    promptVersion: LEARNING_EXTRACTOR_PROMPT_VERSION,
    temperature: job.temperature || 0.0,
    reviewStatus: job.reviewStatus || 'auto'
  };
}
```

#### 5. Trust and Reputation (Future)

**Publisher Reputation System** (post-MVP):
- Track download counts, citations, user feedback
- Compute reputation score based on:
  - Number of published learnings
  - Quality ratings from consumers
  - Citation count (how often learnings are referenced)
  - Longevity (how long publisher has been active)
  - Verification history (zero violations = boost)

**Web of Trust** (post-MVP):
- Users can endorse/vouch for publishers
- Transitive trust: "I trust publishers that Alice trusts"
- Dispute resolution for reported malicious content

## GPT-5 Review Summary

**Review Date**: 2025-01-16
**Model**: gpt-5
**Verdict**: Strong direction and threat model with critical corrections required
**Review File**: `/docs/reviews/gpt5-adr-011-review-2025-01-16.txt`

### Critical Issues Fixed

#### 1. **Metadata Hash Circularity** ✅ FIXED
**Issue**: metadataHash included integrityChecks which contained metadataHash (circular dependency)
**Impact**: Verification would always fail - cannot compute hash of object containing itself
**Fix**:
- Exclude integrityChecks from metadataBody when computing metadataHash
- Build metadataBody = { provenance, consent, attestations WITHOUT integrityChecks }
- Add integrityChecks AFTER computing metadataHash
- Document explicitly in code comments

**Code Location**: `signLearning()` step 6, `verifyLearning()` step 3

#### 2. **Timestamp Mismatch** ✅ FIXED
**Issue**: signLearning created separate timestamps for provenance and signingPayload, causing signature verification to fail
**Impact**: Signatures would not verify due to timestamp mismatch
**Fix**:
- Create ONE timestamp (provenance.timestamp) as single source of truth
- Use provenance.timestamp in signingPayload (not new Date())
- Document "SINGLE SOURCE OF TRUTH" in comments

**Code Location**: `signLearning()` step 2 and 9, `verifyLearning()` step 6

#### 3. **Canonicalization Inconsistency** ✅ FIXED
**Issue**: Used JSON.stringify() instead of RFC 8785 canonical JSON for hashing
**Impact**: Same object could produce different hashes (key ordering, whitespace)
**Fix**:
- Use canonicalize() library (RFC 8785) for ALL cryptographic operations
- NEVER use JSON.stringify() for hashing or signing
- Add null checks for canonicalization failures

**Code Location**: All hashing and signing operations

#### 4. **CLI Secret Exposure** ✅ FIXED
**Issue**: macOS `security -w "secret"` exposed private key via process args (visible in ps, shell history)
**Impact**: Critical security vulnerability - private keys leaked to all system users
**Fix**:
- Replace CLI with keytar library (native Keychain Services API)
- No CLI invocation, no process args, no shell history leakage
- Document security issue and solution in code comments

**Code Location**: Appendix, macOS Keychain section

#### 5. **EVM Identity Mismatch** ✅ FIXED
**Issue**: Cannot derive EVM address from Ed25519 public key (different elliptic curves)
**Impact**: Upload flow would fail - cannot sign transactions with Ed25519 key
**Fix**:
- Hybrid approach: Ed25519 for content signing (off-chain), separate secp256k1/EVM key for transactions
- Publisher uses EVM wallet (MetaMask) to submit transactions
- Store Ed25519 public key on-chain for verification reference
- Verification happens OFF-CHAIN (no EVM precompile for Ed25519)

**Code Location**: Smart contract design, upload flow integration

#### 6. **Missing Provenance Fields** ✅ FIXED
**Issue**: Lacked reproducibility metadata (toolchain commit SHA, lockfile hash, Node version)
**Impact**: Cannot reproduce builds or verify supply chain integrity
**Fix**:
- Added toolchainCommitSha: Git commit of sanitizer/extractor code
- Added lockfileHash: SHA-256 of package-lock.json
- Added nodeVersion: Node.js runtime version
- Enables SLSA/in-toto attestations in future

**Code Location**: Provenance interface, signLearning() step 2

#### 7. **Privacy Concerns** ✅ FIXED
**Issue**: sourceConversationId and deviceId create linkability between learnings
**Impact**: Can deanonymize publishers by correlating published learnings
**Fix**:
- EXCLUDE sourceConversationId from published artifact (keep local-only)
- EXCLUDE deviceId or make it clearly pseudonymous
- Document privacy protection in interface comments

**Code Location**: SignedLearning interface, provenance metadata

#### 8. **Missing Consent/License** ✅ FIXED
**Issue**: No license or consent fields (required per STANDARDS.md)
**Impact**: Published learnings lack licensing information (compliance violation)
**Fix**:
- Added consent object with license and consentType
- Default to "CC-BY-4.0" or "ODC-By"
- Verify consent/license present during verification
- Document requirement per STANDARDS.md

**Code Location**: SignedLearning interface, signLearning() step 4, verifyLearning() step 10

### Strengths Highlighted by GPT-5

- Clear articulation of trust problem and threat scenarios
- Sensible choice of Ed25519 and RFC 8785 canonicalization
- Good testing strategy with property-based tests
- Phased implementation allows iterative hardening
- On-chain anchoring of both content and metadata hashes

### Additional Recommendations Implemented

#### Cryptographic Best Practices
- **Domain separation tag**: "gcn.signedlearning.v1" prevents cross-protocol replay attacks
- **Schema versioning**: schemaVersion field enables future migrations
- **Algorithm agility**: algorithm, hashAlgorithm, canonicalization fields explicit
- **Key ID derivation**: keyId = "ed25519:base64url(sha256(publicKey))" for stable identification
- **Consistent encoding**: base64url for all binary data (publicKey, signature)
- **UTF-8 byte signing**: Sign UTF-8 bytes of canonical JSON, not strings

#### Attestation Improvements
- **Merkle root**: sanitizationLogMerkleRoot for tamper-proof log anchoring
- **Redaction summary**: counts by category (EMAIL, API_KEY, etc.)
- **Toolchain provenance**: Git commit SHA, lockfile hash, Node version

#### Blockchain Optimizations
- **Per-publisher nonce**: Prevents replay attacks and enables freshness checks
- **ULID as bytes16**: 128-bit encoding for gas efficiency (not string or bytes32)
- **bytes32 for hashes**: Native Solidity type for SHA-256 hashes
- **bytes for publicKey**: 32-byte Ed25519 public key (not string)

#### Verification Policies
- **Algorithm validation**: Reject unsupported algorithms during verification
- **Timestamp freshness**: Optional policy (30-day default, configurable)
- **Consent validation**: Verify license/consent fields present (STANDARDS compliance)
- **Hash matching**: Verify both contentHash and metadataHash

### Future Enhancements Suggested by GPT-5

#### Standards-Based Envelopes (Post-MVP)
- Consider DSSE (Dead Simple Signing Envelope) or COSE_Sign1
- Reduces custom envelope risks
- Standards-based migration path

#### Decentralized Identity (Post-MVP)
- DIDs + Verifiable Credentials for organizational publishers
- No KYC/OIDC requirement
- Supports Web3 ethos

#### Supply Chain Security (Future)
- SLSA attestations for toolchain integrity
- in-toto framework for build provenance
- Signed releases and reproducible builds

#### Additional Risks to Document
- Canonicalization drift across languages/platforms (add conformance tests)
- IPFS pinning/liveness strategy (multiple providers, retention policy)
- Supply chain compromise (signed releases, provenance attestations)

## Consequences

### Positive

- **Verifiable authenticity** - Consumers can verify learnings from claimed publisher
- **Tamper detection** - Any modification invalidates signature
- **Accountability** - Publishers responsible for their content
- **Reputation building** - Good publishers build trust over time
- **Audit trail** - Full provenance from capture to upload
- **Tool version transparency** - Consumers know what versions created the learning
- **Sanitization confidence** - Attestations prove PII removal
- **Attack resistance** - Cryptographic signatures prevent impersonation
- **Compliance support** - Chain of custody for data lineage requirements
- **Trust network foundation** - Enables future reputation/endorsement systems

### Negative

- **Implementation complexity** - Signing, key management, verification logic
- **Key management burden** - Users must protect private keys (though OS handles this)
- **Platform dependencies** - Different keychains per OS
- **Storage overhead** - Signatures and attestations increase payload size (~500 bytes)
- **Verification cost** - Consumers must verify signatures (though fast with Ed25519)
- **Key rotation complexity** - Changing keys requires migration strategy
- **Privacy tradeoff** - Public keys create persistent identities (but pseudonymous)
- **Blockchain cost** - Gas fees for on-chain registration (mitigated by L2s)

### Neutral

- **Device-level identity** - Each device has separate identity (could be feature or bug)
- **No central authority** - Decentralized trust model (aligns with Web3 philosophy)
- **Optional verification** - Consumers can choose to skip verification (not recommended)
- **Signature algorithm locked** - Ed25519 chosen for MVP (could support others later)

## Alternatives Considered

### Alternative 1: No Signing (Status Quo)

**Description**: Publish learnings without signatures or attestations.

**Pros**:
- Simple implementation
- No key management
- Zero overhead

**Cons**:
- **Zero trust** - No way to verify authenticity
- **Impersonation attacks** - Anyone can claim to be anyone
- **No accountability** - Publishers can deny their uploads
- **No reputation** - Can't build trust networks
- **Malicious content** - Poisoned learnings indistinguishable from legitimate

**Why not chosen**: Unacceptable for a trustworthy knowledge network. External review specifically called this out.

### Alternative 2: Centralized PKI (Certificate Authority)

**Description**: Use traditional PKI with a central Certificate Authority.

**Pros**:
- Well-established standards (X.509)
- Revocation via CRLs/OCSP
- Strong identity binding
- Trusted by enterprises

**Cons**:
- **Centralization** - Single point of failure/control
- **Contradicts Web3 ethos** - Defeats purpose of decentralized network
- **Requires KYC** - CA must verify identities
- **Privacy violation** - Real-world identities tied to uploads
- **Cost** - Certificate issuance fees
- **Complexity** - Full X.509 infrastructure

**Why not chosen**: Contradicts decentralized architecture. Introduces centralized trust dependency.

### Alternative 3: Keyless Signing (Sigstore/Fulcio Model)

**Description**: Use ephemeral keys with OIDC identity binding (like Sigstore).

**Pros**:
- No long-term key management
- Identity tied to existing OIDC providers (Google, GitHub)
- Transparency log for auditability
- Modern approach

**Cons**:
- **Requires OIDC provider** - Not always available/desired
- **Privacy issues** - Real identity leaked via OIDC claims
- **Complexity** - Fulcio CA, Rekor transparency log, etc.
- **Dependency** - Relies on external services
- **Not fully decentralized** - OIDC providers are centralized

**Why not chosen**: Too complex for MVP. Privacy concerns with OIDC identity. **Future consideration**: Could add as optional identity binding mechanism post-MVP.

### Alternative 4: Blockchain-Native Signing (Ethereum Keys)

**Description**: Use Ethereum keypairs (secp256k1) instead of Ed25519.

**Pros**:
- Native blockchain compatibility
- Existing wallet support (MetaMask)
- Single key for signing and transactions
- Standard in Web3 ecosystem

**Cons**:
- **Larger signatures** - secp256k1 signatures ~65 bytes vs Ed25519 ~64 bytes (marginal)
- **Slower verification** - secp256k1 slower than Ed25519
- **Key security** - Users must manage Ethereum private keys (risky)
- **Wallet dependency** - Requires wallet software

**Why not chosen**: **ACTUALLY A STRONG CONTENDER**. Could simplify architecture by using single Ethereum key. Revisit during implementation.

### Alternative 5: Multi-Signature Threshold Signing

**Description**: Require K-of-N signatures to publish (e.g., 2-of-3).

**Pros**:
- Higher security threshold
- Prevents single key compromise
- Supports organizational publishing

**Cons**:
- **Too complex for MVP** - Individual users don't need this
- **UX burden** - Coordinate multiple signers
- **Not applicable** - Single-user publishing doesn't need multi-sig

**Why not chosen**: Overkill for individual publisher model. **Future consideration**: Could support for organizational/team accounts.

### Alternative 6: Hardware Security Module (HSM) Storage

**Description**: Store private keys in hardware devices (YubiKey, TPM).

**Pros**:
- Maximum key security
- Hardware-backed operations
- Tamper resistance

**Cons**:
- **Requires hardware** - Not all users have HSMs
- **Complexity** - Platform-specific integrations
- **Cost** - Hardware purchase required
- **Portability** - Keys locked to specific device

**Why not chosen**: Too high barrier to entry. OS keychain provides adequate security for MVP. **Future consideration**: Optional HSM support for high-security users.

## Implementation Plan

### Phase 1: Key Management (MVP)

1. Generate Ed25519 keypair on first run
2. Store in OS keychain (platform-specific)
3. Provide key export/import for backup
4. Add key rotation capability

**Acceptance Criteria**:
- Keys generated and stored securely
- Private keys never exposed in logs/UI
- Cross-platform support (macOS, Windows, Linux)
- Key backup mechanism exists

### Phase 2: Signing & Verification (MVP)

1. Implement `signLearning()` function with RFC 8785 canonicalization
2. Implement `verifyLearning()` function with same canonicalization
3. Add signature to upload payload
4. Verify signatures on download/query
5. Implement helper functions (bytesToHex, bytesToBase64Url, etc.)
6. Add domain separation and schema versioning
7. Implement keyId derivation

**Acceptance Criteria**:
- All uploaded learnings have valid signatures
- Verification rejects tampered content
- Verification rejects invalid signatures
- Verification rejects timestamp mismatches
- Metadata hash excludes integrityChecks (no circularity)
- Single timestamp source of truth (provenance.timestamp)
- RFC 8785 canonical JSON used throughout
- Performance <100ms for signing, <50ms for verification
- Cross-implementation test vectors pass

### Phase 3: Attestations (MVP)

1. Collect sanitization evidence from `sanitization_log`
2. Collect extraction evidence from `job_queue`
3. Add toolchain provenance (commit SHA, lockfile hash, Node version)
4. Include consent object with license and consentType
5. Compute Merkle root of sanitization log entries
6. Include attestations in signed payload
7. Display attestations in MCP query results

**Acceptance Criteria**:
- Attestations include all required fields (per GPT-5 review)
- Sanitization confidence accurately reflects detection quality
- Tool versions match actual deployed versions
- Toolchain provenance (commitSha, lockfileHash, nodeVersion) present
- Consent object present with license (CC-BY-4.0 or ODC-By)
- Merkle root computed for sanitization log
- sourceConversationId EXCLUDED from published artifact (privacy)
- Attestations visible to consumers

### Phase 4: Blockchain Integration (MVP)

1. Deploy `LearningRegistry` smart contract to L2
2. Implement EVM wallet integration (MetaMask, WalletConnect)
3. Implement ULID to bytes16 conversion
4. Implement hash to bytes32 conversion
5. Implement CID to bytes encoding
6. Integrate contract calls into upload flow
7. Store on-chain transaction hashes
8. Verify on-chain records match IPFS content

**Acceptance Criteria**:
- Learnings registered on-chain with correct hashes (bytes32)
- IPFS CID matches on-chain record
- Ed25519 public key stored on-chain (bytes, 32 bytes)
- EVM address (publisher) recorded correctly
- ULID encoded as bytes16 (gas efficiency)
- Hybrid key approach working (Ed25519 + EVM wallet)
- Per-publisher nonce prevents replay
- Verification possible via blockchain query
- Off-chain Ed25519 signature verification working

### Phase 5: Reputation System (Post-MVP)

1. Track download counts
2. Implement rating/feedback mechanism
3. Compute reputation scores
4. Display publisher reputation in MCP results

**Acceptance Criteria**:
- Publishers have visible reputation scores
- High-reputation publishers ranked higher
- Feedback mechanism prevents spam/abuse
- Zero-violation publishers get trust boost

## Risks and Mitigations

### Risk: Private Key Loss

**Impact**: Critical - User loses publishing identity and reputation

**Mitigation**:
- Mandatory key backup during setup
- Export/import functionality
- Optional multi-device key sharing (future)
- Reputation can be rebuilt with new key
- **No key recovery** - Explicitly document this

### Risk: Private Key Compromise

**Impact**: High - Attacker can impersonate publisher

**Mitigation**:
- OS keychain protection (requires user auth)
- Key rotation mechanism
- Revocation list on blockchain (future)
- Reputation hit for suspicious activity
- Users can publish key revocation notice

### Risk: Clock Skew / Timestamp Manipulation

**Impact**: Medium - Old learnings replayed as new

**Mitigation**:
- Blockchain timestamp is authoritative (block time)
- Local timestamp only for UX
- Consumers check blockchain timestamp
- Reject learnings with future timestamps

### Risk: Signature Algorithm Weakness (Future)

**Impact**: Low (Ed25519 currently secure) - Algorithm broken

**Mitigation**:
- Support multiple algorithms in schema
- Version field in signature structure
- Migration plan to new algorithm
- Monitor cryptography research

### Risk: Attestation Falsification

**Impact**: Medium - Publisher lies about sanitization

**Mitigation**:
- Consumers can re-run sanitization checks
- Reputation system penalizes false attestations
- Random audit sampling by network validators (future)
- Report mechanism for disputed learnings

### Risk: Blockchain Reorg / Finality Issues

**Impact**: Low - On-chain record disappears

**Mitigation**:
- Wait for sufficient confirmations (L2s have fast finality)
- Store IPFS CID as backup identifier
- Re-publish if reorg detected
- Use L2s with economic finality

## Testing Strategy

### Unit Tests

```typescript
describe('Signing and Verification', () => {
  it('should sign and verify a learning', async () => {
    const learning = createTestLearning();
    const signed = await signLearning(learning);
    const result = await verifyLearning(signed);

    expect(result.valid).toBe(true);
  });

  it('should reject tampered content', async () => {
    const signed = await signLearning(createTestLearning());
    signed.learning.content += ' TAMPERED';

    const result = await verifyLearning(signed);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Content hash mismatch');
  });

  it('should reject tampered metadata', async () => {
    const signed = await signLearning(createTestLearning());
    signed.provenance.sanitizerVersion = 'v999.0'; // Tamper

    const result = await verifyLearning(signed);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Metadata hash mismatch');
  });

  it('should reject invalid signature', async () => {
    const signed = await signLearning(createTestLearning());
    signed.signature.signatureValue = 'invalid';

    const result = await verifyLearning(signed);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid Ed25519 signature');
  });

  it('should reject public key substitution', async () => {
    const signed = await signLearning(createTestLearning());
    const fakeKey = ed.utils.randomPrivateKey();
    const fakePublicKey = await ed.getPublicKey(fakeKey);
    signed.signature.publicKey = bytesToBase64Url(fakePublicKey);

    const result = await verifyLearning(signed);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Key ID mismatch');
  });

  // GPT-5 Fix: Metadata hash circularity prevention
  it('should exclude integrityChecks from metadataHash', async () => {
    const learning = createTestLearning();
    const signed = await signLearning(learning);

    // Verify integrityChecks is NOT in the metadata body used for hashing
    const metadataBody = {
      provenance: signed.provenance,
      consent: signed.consent,
      attestations: {
        sanitizationEvidence: signed.attestations.sanitizationEvidence,
        extractionEvidence: signed.attestations.extractionEvidence
        // integrityChecks NOT included
      }
    };

    const recomputedHash = bytesToHex(
      sha256(new TextEncoder().encode(canonicalize(metadataBody) || ''))
    );

    expect(recomputedHash).toBe(signed.attestations.integrityChecks.metadataHash);
  });

  // GPT-5 Fix: Single timestamp source of truth
  it('should use same timestamp in provenance and signingPayload', async () => {
    const learning = createTestLearning();
    const signed = await signLearning(learning);

    // Rebuild signing payload with same timestamp
    const signingPayload = {
      context: "gcn.signedlearning.v1",
      schemaVersion: signed.signature.schemaVersion,
      hashAlgorithm: signed.signature.hashAlgorithm,
      canonicalization: signed.signature.canonicalization,
      learningId: signed.learning.id,
      contentHash: signed.attestations.integrityChecks.contentHash,
      metadataHash: signed.attestations.integrityChecks.metadataHash,
      timestamp: signed.provenance.timestamp, // SAME timestamp
      keyId: signed.signature.keyId
    };

    // Verify signature with this payload
    const payloadBytes = new TextEncoder().encode(canonicalize(signingPayload) || '');
    const publicKeyBytes = base64UrlToBytes(signed.signature.publicKey);
    const signatureBytes = base64UrlToBytes(signed.signature.signatureValue);

    const valid = await ed.verify(signatureBytes, payloadBytes, publicKeyBytes);
    expect(valid).toBe(true);
  });

  // GPT-5 Fix: RFC 8785 canonicalization
  it('should produce same hash regardless of key order', () => {
    const obj1 = { b: 2, a: 1, c: 3 };
    const obj2 = { a: 1, c: 3, b: 2 };

    const canonical1 = canonicalize(obj1);
    const canonical2 = canonicalize(obj2);

    expect(canonical1).toBe(canonical2);
    expect(canonical1).toBe('{"a":1,"b":2,"c":3}'); // RFC 8785 format
  });

  // GPT-5 Fix: Consent/license validation
  it('should include consent and license', async () => {
    const learning = createTestLearning();
    const signed = await signLearning(learning);

    expect(signed.consent).toBeDefined();
    expect(signed.consent.license).toBe('CC-BY-4.0');
    expect(signed.consent.consentType).toBe('explicit');
  });

  it('should warn if license missing', async () => {
    const learning = createTestLearning();
    const signed = await signLearning(learning);
    delete signed.consent.license; // Remove license

    const result = await verifyLearning(signed);
    expect(result.valid).toBe(true); // Still valid signature
    expect(result.warning).toContain('Missing license information');
  });
});
```

### Integration Tests

```typescript
describe('End-to-End Signing Flow', () => {
  it('should sign, upload, download, and verify', async () => {
    // Sign
    const learning = await extractLearning(conversationId);
    const signed = await signLearning(learning);

    // Upload to IPFS + blockchain
    const { ipfsCid, txHash } = await uploadSignedLearning(signed);

    // Download from IPFS
    const downloaded = await ipfs.get(ipfsCid);

    // Verify signature
    const result = await verifyLearning(downloaded);
    expect(result.valid).toBe(true);

    // Verify blockchain record
    const onChainRecord = await learningRegistry.learnings(learning.id);
    expect(onChainRecord.ipfsCid).toBe(ipfsCid);
    expect(onChainRecord.contentHash).toBe(signed.attestations.integrityChecks.contentHash);
  });
});
```

### Property-Based Tests

```typescript
import fc from 'fast-check';

describe('Signing Properties', () => {
  it('signing is deterministic with same key', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 100 }), // Learning content
        (content) => {
          const learning = { ...testLearning, content };
          const sig1 = signLearningSync(learning);
          const sig2 = signLearningSync(learning);

          // Same content + same key = same signature
          return sig1.signature.signatureValue === sig2.signature.signatureValue;
        }
      )
    );
  });

  it('any modification invalidates signature', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 100 }),
        fc.nat(),
        (content, tamperIndex) => {
          const learning = { ...testLearning, content };
          const signed = signLearningSync(learning);

          // Tamper with one character
          const tampered = {
            ...signed,
            learning: {
              ...signed.learning,
              content: content.substring(0, tamperIndex % content.length) +
                       'X' +
                       content.substring((tamperIndex % content.length) + 1)
            }
          };

          const result = verifyLearningSync(tampered);
          return !result.valid;
        }
      )
    );
  });
});
```

### Performance Tests

```typescript
describe('Signing Performance', () => {
  it('should sign learning in <100ms', async () => {
    const learning = createTestLearning();

    const start = performance.now();
    await signLearning(learning);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should verify learning in <50ms', async () => {
    const signed = await signLearning(createTestLearning());

    const start = performance.now();
    await verifyLearning(signed);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });
});
```

## Security Audit Checklist

Before production deployment:

### Cryptographic Implementation
- [ ] Ed25519 implementation reviewed (use audited library like `@noble/ed25519`)
- [ ] RFC 8785 canonical JSON used for ALL hashing and signing (NEVER JSON.stringify)
- [ ] Metadata hash excludes integrityChecks (no circular dependency)
- [ ] Single timestamp source of truth (provenance.timestamp)
- [ ] Domain separation tag ("gcn.signedlearning.v1") present
- [ ] Schema versioning fields (schemaVersion, algorithm, hashAlgorithm) present
- [ ] UTF-8 byte encoding used for signing (not strings)
- [ ] Base64url encoding consistent (publicKey, signatureValue)
- [ ] Key ID derivation correct (sha256 of public key)
- [ ] Hash algorithm (SHA-256) is collision-resistant
- [ ] Signature verification cannot be bypassed
- [ ] Cross-implementation test vectors pass

### Key Management
- [ ] Key storage tested on all platforms (macOS, Windows, Linux)
- [ ] keytar library used (NO CLI commands like `security -w`)
- [ ] Private keys never logged or exposed in UI
- [ ] Private keys never appear in process args or shell history
- [ ] Key export encrypted with Argon2id + AEAD
- [ ] Fallback file storage has chmod 0600 permissions
- [ ] Key rotation mechanism implemented
- [ ] Key backup mechanism exists

### Attestations & Provenance
- [ ] Attestation fields cannot be omitted
- [ ] Toolchain provenance included (commitSha, lockfileHash, nodeVersion)
- [ ] Consent object present with license and consentType
- [ ] sourceConversationId EXCLUDED from published artifact (privacy)
- [ ] deviceId EXCLUDED or clearly pseudonymous (privacy)
- [ ] Merkle root of sanitization log computed

### Blockchain Integration
- [ ] Hybrid key approach working (Ed25519 + EVM wallet)
- [ ] ULID encoded as bytes16 (gas efficiency)
- [ ] Hashes encoded as bytes32 (native Solidity type)
- [ ] Ed25519 public key stored as bytes (32 bytes, not string)
- [ ] Per-publisher nonce prevents replay
- [ ] Blockchain integration tested on testnet
- [ ] Off-chain Ed25519 verification working

### Testing & Performance
- [ ] Timestamp validation prevents replay attacks
- [ ] Property-based tests cover edge cases
- [ ] Performance budgets met (<100ms signing, <50ms verification)
- [ ] Metadata hash circularity tests pass
- [ ] Timestamp consistency tests pass
- [ ] Canonicalization consistency tests pass

## Related Documents

### Architecture
- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Upload & Distribution Architecture](../architecture/architecture-upload-distribution-2025-01-16.md) (to be created)

### Decisions
- [ADR-004: Sanitize Before Storage](./decision-sanitize-before-storage-2025-01-16.md)
- [ADR-007: Consent and Licensing](./decision-consent-licensing-2025-01-16.md) (to be created)
- [ADR-010: Blockchain Selection](./decision-blockchain-selection-2025-01-16.md) (to be created)

### Plans
- [Phase 4: Global Distribution](../plans/plan-phase-4-global-distribution-2025-01-16.md) (to be created)

### Reference
- [Database Schema Reference](../reference/reference-database-schema-2025-01-16.md)
- [Cryptography Standards](../reference/reference-cryptography-standards-2025-01-16.md) (to be created)

### Reviews
- [GPT-5 Holistic Review](../reviews/gpt5-holistic-review-2025-01-16.txt)
- [GPT-5 ADR-011 Review](../reviews/gpt5-adr-011-review-2025-01-16.txt)

---

## Revision History

### 2025-01-16 - Post GPT-5 Review (CURRENT)
**Status**: Accepted (Revised)
**Changes**: Fixed 8 critical issues identified in GPT-5 security review

**Critical Fixes Applied**:
1. ✅ Metadata hash circularity - Exclude integrityChecks from metadataBody
2. ✅ Timestamp mismatch - Single timestamp source of truth (provenance.timestamp)
3. ✅ Canonicalization - RFC 8785 canonical JSON throughout
4. ✅ CLI secret exposure - keytar library (no CLI args leakage)
5. ✅ EVM identity mismatch - Hybrid approach (Ed25519 + EVM wallet)
6. ✅ Missing provenance - Added commitSha, lockfileHash, nodeVersion
7. ✅ Privacy concerns - Excluded sourceConversationId from published artifact
8. ✅ Missing consent - Added consent object with license/consentType

**Review File**: `/docs/reviews/gpt5-adr-011-review-2025-01-16.txt`

**Verdict**: "Strong direction and threat model with critical corrections required" - All corrections implemented.

### 2025-01-16 - Initial Draft
**Status**: Draft (Superseded)
**Changes**: Initial ADR based on GPT-5 holistic review recommendation

---

## Appendix: Key Management Details

### Platform-Specific Key Storage Examples

#### macOS Keychain (Fixed - No CLI Leakage)
```typescript
import keytar from 'keytar';

/**
 * CRITICAL: Use keytar library instead of CLI to avoid exposing secrets in process args
 *
 * SECURITY ISSUE (FIXED):
 * Previous approach used: execSync(`security add-generic-password -w "${secret}"`)
 * This leaked the private key via:
 * - Process arguments visible in `ps` output to all users
 * - Shell history files (~/.bash_history, ~/.zsh_history)
 *
 * SOLUTION:
 * keytar uses native Keychain Services API (Security.framework) via Node.js bindings
 * No CLI invocation, no process args, no shell history leakage
 */

async function storePrivateKey(privateKey: Uint8Array, deviceId: string) {
  const base64Key = Buffer.from(privateKey).toString('base64');

  // keytar uses native Keychain APIs directly (no CLI)
  await keytar.setPassword('global-context-network', deviceId, base64Key);
}

async function loadPrivateKey(deviceId: string): Promise<Uint8Array> {
  const base64Key = await keytar.getPassword('global-context-network', deviceId);

  if (!base64Key) {
    throw new Error('Private key not found in keychain');
  }

  return new Uint8Array(Buffer.from(base64Key, 'base64'));
}

async function deletePrivateKey(deviceId: string): Promise<boolean> {
  return await keytar.deletePassword('global-context-network', deviceId);
}
```

#### Windows DPAPI (with Secure Permissions)
```typescript
import { protectData, unprotectData } from 'dpapi-addon';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

async function storePrivateKey(privateKey: Uint8Array, deviceId: string) {
  const encrypted = protectData(Buffer.from(privateKey), null, 'CurrentUser');
  const keyPath = path.join(process.env.APPDATA!, 'GlobalContextNetwork', `${deviceId}.key`);

  // Create directory with restrictive permissions
  await fs.mkdir(path.dirname(keyPath), { recursive: true });

  // Write encrypted key
  await fs.writeFile(keyPath, encrypted);

  // CRITICAL: Restrict file access to current user only (Windows ACLs)
  // Remove inherited permissions and grant access only to current user
  try {
    execSync(`icacls "${keyPath}" /inheritance:r /grant:r "%USERNAME%:F"`);
  } catch (error) {
    console.warn('Failed to set restrictive permissions on key file:', error);
    // Continue - DPAPI CurrentUser scope provides some protection
  }
}

async function loadPrivateKey(deviceId: string): Promise<Uint8Array> {
  const keyPath = path.join(process.env.APPDATA!, 'GlobalContextNetwork', `${deviceId}.key`);
  const encrypted = await fs.readFile(keyPath);
  const decrypted = unprotectData(encrypted, null, 'CurrentUser');

  return new Uint8Array(decrypted);
}
```

#### Linux Secret Service
```typescript
import * as keytar from 'keytar';

async function storePrivateKey(privateKey: Uint8Array, deviceId: string) {
  const base64Key = Buffer.from(privateKey).toString('base64');
  await keytar.setPassword('global-context-network', deviceId, base64Key);
}

async function loadPrivateKey(deviceId: string): Promise<Uint8Array> {
  const base64Key = await keytar.getPassword('global-context-network', deviceId);
  if (!base64Key) throw new Error('Private key not found');

  return new Uint8Array(Buffer.from(base64Key, 'base64'));
}
```

### Canonical JSON Implementation

```typescript
import canonicalize from 'canonicalize';

function canonicalJSON(obj: any): string {
  // RFC 8785 compliant canonical JSON
  return canonicalize(obj) || '';
}

// Example
const payload = {
  learningId: 'abc123',
  contentHash: 'hash1',
  metadataHash: 'hash2',
  timestamp: '2025-01-16T12:00:00.000Z'
};

const canonical = canonicalJSON(payload);
// Always produces same string regardless of key order
```

### Ed25519 Library Selection

**Recommended**: `@noble/ed25519`

**Why**:
- Audited implementation
- No dependencies
- Fast (WASM when available)
- TypeScript native
- Active maintenance

**Example**:
```typescript
import * as ed from '@noble/ed25519';

// Generate keypair
const privateKey = ed.utils.randomPrivateKey();
const publicKey = await ed.getPublicKey(privateKey);

// Sign
const message = new TextEncoder().encode('Hello World');
const signature = await ed.sign(message, privateKey);

// Verify
const isValid = await ed.verify(signature, message, publicKey);
```
