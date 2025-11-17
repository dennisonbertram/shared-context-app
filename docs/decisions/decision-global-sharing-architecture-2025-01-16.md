---
title: ADR-008: Global Sharing Architecture (IPFS + Blockchain)
category: decision
date: 2025-01-16
status: proposed
deciders: Claude + Dennison
tags: [ipfs, blockchain, celestia, evm, sharing, decentralization]
---

# ADR-008: Global Sharing Architecture (IPFS + Blockchain)

## Status

**Accepted** (with post-review revisions)

Date: 2025-01-16

**External Review**: GPT-4o and O1 reviews completed (see /tmp/gpt4o-adr008-review.txt, /tmp/o1-adr008-review.txt)

**Key Revisions Applied**:
- Added explicit privacy validation in upload code
- Clarified Celestia vs EVM separation (per STANDARDS.md #15)
- Enhanced consent/licensing requirements (per STANDARDS.md #16)
- Added ULID and ISO-8601 timestamp references
- Strengthened revocation list documentation
- Added legal consultation recommendation

## Context

The Global Context Network aims to enable AI agents to share learnings globally, creating a decentralized knowledge network. After learnings are extracted locally, we need a mechanism to:

1. **Store content immutably** - Learnings should be permanent and tamper-proof
2. **Share globally** - Any agent should be able to access shared learnings
3. **Maintain provenance** - Track who contributed what and when
4. **Enable incentives** - Reward quality contributions (future)
5. **Preserve privacy** - Only share derived learnings, never raw conversations
6. **Support validation** - Enable future validator network (post-MVP)

The user's original vision specified:
- "Put that data on chain or we put it into IPFS and put a hash on the blockchain"
- "Or we could put it into something like Celestia"
- Decentralized storage for global accessibility
- Blockchain for provenance and rewards

**Critical Clarifications** (from STANDARDS.md Section 15):
- **Celestia is NOT EVM-compatible** - It's a data availability layer
- **Smart contracts require EVM chain** - Base, Arbitrum, Optimism, or Polygon
- **Don't conflate the two** - EVM contracts ≠ Celestia DA

**Privacy Constraints** (STANDARDS.md #1, #6):
- NEVER upload raw conversations (contains PII even after sanitization)
- ONLY upload derived learnings (already aggregated, abstracted, generalized)
- Learnings are privacy-safe by design (see learning extraction spec)
- **Excludes chain-of-thought** per STANDARDS.md #6 (provider policy compliance)
- **Code-level validation**: Upload functions MUST reject any content flagged as raw/unsanitized

**Immutability vs Right-to-Delete Tension**:
- Blockchain and IPFS are immutable by design
- GDPR/CCPA may require deletion capability
- Mitigation: Only upload content we're comfortable making permanent
- **Revocation list approach** (see below) provides logical deletion per STANDARDS.md #16

## Decision

Use a hybrid architecture for MVP:
- **IPFS** for content storage (learnings only)
- **EVM L2 blockchain** for transaction records and provenance
- **Celestia** deferred to post-MVP for data availability optimization

### Content Storage: IPFS

**What we store**:
- Derived learnings ONLY (never raw conversations)
- Learning metadata (title, summary, tags, context)
- IPLD schema-compliant documents

**Why IPFS**:
- Content-addressed storage (CIDs are deterministic hashes)
- Globally accessible via public gateways
- Decentralized by design
- No single point of failure
- Free to store (pay for pinning services)
- Built-in deduplication (same content = same CID)

**Pinning Strategy**:
```
Local IPFS node (primary) → Pinning service (backup) → Public gateways (access)
```

**IPLD Schema for Learnings**:
```ipld
type Learning struct {
  id String           # ULID (per STANDARDS.md #4)
  title String
  summary String
  context String
  tags [String]
  category String     # "pattern" | "solution" | "pitfall" | "technique"
  sourceProject String?
  created String      # ISO-8601 timestamp (per STANDARDS.md #7)
  version String      # Schema version
  license String      # "CC-BY-4.0"
}
```

**NOTE**: All learnings are **derived only** (aggregated, sanitized, abstracted). No raw conversation content is ever included in this schema.

### Transaction Layer: EVM L2 Blockchain

**Chain Selection for MVP**: **Base** (Coinbase L2)

**Why Base**:
- Low transaction fees (~$0.01 per transaction)
- Fast finality (~2 seconds)
- Ethereum-compatible (standard tooling)
- Good developer experience
- Growing ecosystem
- Production-ready and stable

**Alternative EVM L2s considered**:
- Arbitrum: Similar fees, larger ecosystem
- Optimism: Similar tech to Base
- Polygon: Lower fees but less Ethereum-aligned
- **Decision**: Base for simplicity and cost-effectiveness

**What we record on-chain**:
- IPFS CID of learning
- Contributor address (optional pseudonymous identity)
- Timestamp
- Metadata hash (for verification)
- License type

**Smart Contract (Minimal MVP)**:
```solidity
// LearningRegistry.sol - Minimal upload tracking
contract LearningRegistry {
  struct Upload {
    string ipfsCid;      // IPFS content identifier
    address contributor; // Who uploaded
    uint256 timestamp;   // When uploaded
    bytes32 metadataHash; // Hash of metadata for verification
    string license;      // "CC-BY-4.0"
  }

  mapping(string => Upload) public uploads;
  string[] public cids;

  event LearningUploaded(
    string indexed ipfsCid,
    address indexed contributor,
    uint256 timestamp
  );

  function uploadLearning(
    string memory ipfsCid,
    bytes32 metadataHash,
    string memory license
  ) public {
    require(bytes(uploads[ipfsCid].ipfsCid).length == 0, "Already exists");

    uploads[ipfsCid] = Upload({
      ipfsCid: ipfsCid,
      contributor: msg.sender,
      timestamp: block.timestamp,
      metadataHash: metadataHash,
      license: license
    });

    cids.push(ipfsCid);

    emit LearningUploaded(ipfsCid, msg.sender, block.timestamp);
  }

  function getLearning(string memory ipfsCid)
    public
    view
    returns (Upload memory)
  {
    return uploads[ipfsCid];
  }

  function getTotalUploads() public view returns (uint256) {
    return cids.length;
  }
}
```

**Post-MVP Enhancements**:
- Token rewards for validated contributions
- Validator quorum mechanisms
- Quality scoring on-chain
- Reputation system
- Governance mechanisms

### Data Availability Layer: Celestia (Deferred)

**Why defer Celestia**:
- MVP doesn't need DA layer optimization
- Adds complexity without immediate benefit
- IPFS + pinning services sufficient for MVP scale
- Can integrate post-MVP without breaking changes

**CRITICAL** (per STANDARDS.md #15):
- **Celestia is a data availability layer, NOT an execution layer**
- **Celestia is NOT EVM-compatible** - cannot run smart contracts
- **Don't conflate Celestia (DA) with Base L2 (execution)**
- Celestia would be used alongside EVM L2, not instead of it

**Future Celestia Use Case**:
- Store content commitments on Celestia (data availability proofs)
- Reduce on-chain storage costs for large datasets
- Enable data availability sampling
- Support high-volume uploads with DA guarantees

**Integration Path** (Post-MVP):
```
IPFS (content storage) + Celestia (DA proofs) + Base L2 (smart contracts/transactions)
```

All three layers serve different purposes and complement each other.

## Consequences

### Positive

- **Immutable learnings** - IPFS CIDs guarantee content integrity
- **Global accessibility** - Anyone can fetch from IPFS
- **Decentralized** - No single point of control
- **Provenance tracking** - Blockchain records who contributed what
- **Privacy-safe** - Only derived learnings uploaded (no raw conversations)
- **Cost-effective** - Base L2 fees are negligible (~$0.01/upload)
- **Future-proof** - Can add Celestia, validators, tokens later
- **License clarity** - CC-BY-4.0 enables reuse
- **Standard tooling** - IPFS and EVM have mature ecosystems

### Negative

- **Immutability challenge** - Can't delete uploaded learnings
- **Pinning costs** - Need to pay pinning services for reliability
- **Blockchain dependency** - Requires wallet, gas fees
- **Complexity** - More complex than centralized storage
- **Censorship risk** - Pinning services could refuse content
- **Gateway reliance** - Public gateways could go down (mitigated by multiple gateways)
- **Gas price volatility** - L2 fees could spike (unlikely but possible)

### Neutral

- **IPLD schema versioning** - Need migration strategy for schema changes
- **CID format** - Using CIDv1 with base32 encoding
- **Pinning service choice** - Pinata, Web3.Storage, or self-hosted
- **Wallet management** - Users need private keys (can use session keys)

## Alternatives Considered

### Alternative 1: Centralized Cloud Storage (S3/GCS)

**Description**: Store learnings in AWS S3 or Google Cloud Storage.

**Pros**:
- Simple implementation
- No blockchain complexity
- Predictable costs
- Fast access
- Easy deletion (GDPR compliance)

**Cons**:
- **Single point of control** - Platform can censor or delete
- **Not decentralized** - Violates core vision
- **No provenance** - Hard to prove who contributed
- **Trust required** - Users must trust platform
- **Vendor lock-in** - Hard to migrate

**Why not chosen**: Violates decentralization principle. Goes against user's original vision.

### Alternative 2: Arweave (Permanent Storage)

**Description**: Use Arweave for permanent, pay-once storage.

**Pros**:
- Truly permanent (pay once, store forever)
- Decentralized
- No pinning costs
- Good for immutable data

**Cons**:
- **Expensive upfront** - ~$5-10 per MB
- **No deletion ever** - Stronger immutability than IPFS
- **Smaller ecosystem** - Less tooling than IPFS
- **GraphQL queries** - Different query model than IPFS

**Why not chosen**: Higher upfront cost. IPFS pinning services provide similar guarantees with more flexibility. Could reconsider post-MVP for truly critical learnings.

### Alternative 3: Filecoin (Decentralized Storage Market)

**Description**: Use Filecoin for decentralized storage with economic incentives.

**Pros**:
- Decentralized storage market
- Built on IPFS
- Storage proofs
- Economic incentives for storage providers

**Cons**:
- **More complex** - Deal-making, retrieval markets
- **Higher costs** - Storage deals can be expensive
- **Slower** - Deal negotiation takes time
- **Overkill for MVP** - Complexity not justified

**Why not chosen**: Too complex for MVP. IPFS with pinning services is simpler. Could integrate Filecoin post-MVP for larger-scale storage.

### Alternative 4: OrbitDB (P2P Database)

**Description**: Use OrbitDB for distributed, eventually-consistent database.

**Pros**:
- Built on IPFS
- Peer-to-peer
- Database-like queries
- No central server

**Cons**:
- **Eventually consistent** - No strong consistency guarantees
- **Requires peers online** - Data availability depends on peers
- **Smaller ecosystem** - Less mature than pure IPFS
- **Query performance** - Slower than indexed databases

**Why not chosen**: Eventual consistency model not ideal for learnings. IPFS + blockchain provides stronger guarantees. Could use post-MVP for collaborative features.

### Alternative 5: Ethereum Mainnet (No L2)

**Description**: Use Ethereum mainnet for transactions instead of L2.

**Pros**:
- Maximum security
- Largest ecosystem
- Most decentralized
- Best tooling

**Cons**:
- **High gas fees** - $5-50 per transaction
- **Not scalable** - Too expensive for frequent uploads
- **Slower** - ~12 second block times
- **Prohibitive for MVP** - Cost kills adoption

**Why not chosen**: Gas fees are prohibitively expensive. L2s provide 99%+ cost reduction with minimal security trade-offs for this use case.

### Alternative 6: Celestia Only (No EVM)

**Description**: Use Celestia for both data availability and transactions.

**Pros**:
- Single layer
- Optimized for data availability
- Lower costs than Ethereum

**Cons**:
- **Not EVM-compatible** - Can't run Solidity smart contracts
- **Smaller ecosystem** - Less tooling and infrastructure
- **No smart contract layer** - Would need separate execution layer
- **Immature** - Celestia is newer, less battle-tested

**Why not chosen**: Celestia is a DA layer, not an execution layer. We need smart contracts for upload registry and future token mechanics. Could use Celestia for DA post-MVP alongside EVM L2.

## Implementation

### Upload Flow

```typescript
import { ulid } from 'ulid'; // STANDARDS.md #4

async function uploadLearning(learning: Learning): Promise<UploadResult> {
  // 1. CRITICAL: Validate learning is derived (not raw conversation)
  // Per STANDARDS.md #1 and #6 - never upload raw or unsanitized content
  if (learning.sourceType === 'raw_conversation') {
    throw new Error('PRIVACY VIOLATION: Cannot upload raw conversations');
  }

  if (!learning.isDerived) {
    throw new Error('PRIVACY VIOLATION: Only derived learnings can be uploaded');
  }

  // Verify no chain-of-thought content (STANDARDS.md #6)
  if (learning.containsChainOfThought) {
    throw new Error('POLICY VIOLATION: Cannot upload chain-of-thought content');
  }

  // 2. Convert to IPLD format (all learnings are already sanitized/derived)
  const ipldDoc = formatAsIPLD(learning);

  // 3. Upload to IPFS
  const ipfsClient = create({ url: 'http://localhost:5001' });
  const { cid } = await ipfsClient.add(JSON.stringify(ipldDoc));

  // 4. Pin to pinning service (backup)
  await pinToPinata(cid.toString());

  // 5. Generate metadata hash
  const metadataHash = keccak256(JSON.stringify({
    title: learning.title,
    summary: learning.summary,
    created: learning.created
  }));

  // 6. Record on Base L2
  const contract = new ethers.Contract(
    LEARNING_REGISTRY_ADDRESS,
    LEARNING_REGISTRY_ABI,
    signer
  );

  const tx = await contract.uploadLearning(
    cid.toString(),
    metadataHash,
    'CC-BY-4.0'
  );

  await tx.wait();

  // 7. Record upload in local database
  // Use ULID for ID (STANDARDS.md #4) and ISO-8601 timestamp (STANDARDS.md #7)
  await db.uploads.insert({
    id: ulid(),
    learning_id: learning.id,
    ipfs_cid: cid.toString(),
    blockchain_tx: tx.hash,
    blockchain_timestamp: tx.blockNumber, // Block timestamp from chain
    status: 'completed',
    created_at: new Date().toISOString() // ISO-8601 local timestamp
  });

  return {
    ipfsCid: cid.toString(),
    txHash: tx.hash,
    publicUrl: `https://ipfs.io/ipfs/${cid.toString()}`
  };
}
```

### Query Flow

```typescript
async function queryLearning(ipfsCid: string): Promise<Learning> {
  // 1. Verify on blockchain
  const contract = new ethers.Contract(
    LEARNING_REGISTRY_ADDRESS,
    LEARNING_REGISTRY_ABI,
    provider
  );

  const upload = await contract.getLearning(ipfsCid);

  if (!upload.ipfsCid) {
    throw new Error('Learning not found on blockchain');
  }

  // 2. Fetch from IPFS (try multiple gateways)
  const gateways = [
    `https://ipfs.io/ipfs/${ipfsCid}`,
    `https://gateway.pinata.cloud/ipfs/${ipfsCid}`,
    `https://${ipfsCid}.ipfs.dweb.link`
  ];

  for (const gateway of gateways) {
    try {
      const response = await fetch(gateway, { timeout: 5000 });
      const learning = await response.json();

      // 3. Verify metadata hash
      const computedHash = keccak256(JSON.stringify({
        title: learning.title,
        summary: learning.summary,
        created: learning.created
      }));

      if (computedHash !== upload.metadataHash) {
        throw new Error('Metadata hash mismatch');
      }

      return learning;
    } catch (err) {
      console.warn(`Gateway ${gateway} failed, trying next...`);
    }
  }

  throw new Error('All IPFS gateways failed');
}
```

### Consent and Manual Approval

**CRITICAL** (STANDARDS.md #16 - Consent & Licensing):
- **Default mode: Local-only** (no uploads)
- **Opt-in required**: User must explicitly enable global sharing
- **Manual approval gate**: Each upload requires confirmation (MVP)
- All uploads require explicit user consent with preview

```typescript
interface UploadApproval {
  learningId: string;
  preview: string;        // What will be uploaded
  ipfsCid?: string;       // Computed CID (deterministic)
  estimatedGasCost: string; // "~$0.01"
  license: string;        // "CC-BY-4.0"
  permanent: boolean;     // true (cannot delete)
}

async function requestUploadApproval(
  learning: Learning
): Promise<UploadApproval> {
  // Generate preview
  const preview = `
Title: ${learning.title}
Summary: ${learning.summary}
Tags: ${learning.tags.join(', ')}
License: CC-BY-4.0
Permanent: Yes (cannot be deleted once uploaded)
  `;

  // Compute CID deterministically
  const ipldDoc = formatAsIPLD(learning);
  const cid = await computeCID(JSON.stringify(ipldDoc));

  // Estimate gas cost
  const gasEstimate = await estimateGasCost();

  return {
    learningId: learning.id,
    preview,
    ipfsCid: cid,
    estimatedGasCost: `~$${(gasEstimate / 1e18).toFixed(4)}`,
    license: 'CC-BY-4.0',
    permanent: true
  };
}

// User must explicitly approve via MCP or CLI
// This is MANDATORY per STANDARDS.md #16 (not optional)
async function approveUpload(approval: UploadApproval): Promise<void> {
  // Confirmation dialog must be shown
  const confirmed = await showConfirmationDialog({
    title: "Upload Learning to Global Network",
    message: approval.preview,
    warning: "⚠️  This upload is PERMANENT and cannot be deleted",
    license: "CC-BY-4.0 (Attribution required)",
    cost: approval.estimatedGasCost,
    buttons: ["Cancel", "Upload Permanently"]
  });

  if (!confirmed) {
    // User declined - content remains local only
    throw new Error('Upload cancelled by user');
  }

  // User confirmed - trigger the actual upload
  await uploadLearning(approval.learningId);
}
```

### Pinning Service Integration

```typescript
interface PinningService {
  pin(cid: string): Promise<void>;
  unpin(cid: string): Promise<void>;
  status(cid: string): Promise<PinStatus>;
}

class PinataService implements PinningService {
  async pin(cid: string): Promise<void> {
    const response = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PINATA_JWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ hashToPin: cid })
    });

    if (!response.ok) {
      throw new Error(`Pinning failed: ${response.statusText}`);
    }
  }

  async status(cid: string): Promise<PinStatus> {
    const response = await fetch(
      `https://api.pinata.cloud/data/pinList?hashContains=${cid}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PINATA_JWT}`
        }
      }
    );

    const data = await response.json();
    return data.rows.length > 0 ? 'pinned' : 'unpinned';
  }
}
```

### Revocation List (Immutability Mitigation)

**Per STANDARDS.md #16 (Consent & Licensing)**: Since IPFS and blockchain are immutable, we use a local revocation list for logical deletion. This provides right-to-delete compliance while respecting the immutability of decentralized storage.

```typescript
// Revocations table
interface Revocation {
  id: string;
  ipfs_cid: string;
  reason: string; // "user-requested" | "privacy-violation" | "quality-issue"
  revoked_at: string;
}

// Check before returning query results
async function isRevoked(ipfsCid: string): Promise<boolean> {
  const revocation = await db.revocations.findOne({ ipfs_cid: ipfsCid });
  return revocation !== null;
}

// MCP queries filter out revoked learnings (STANDARDS.md #16)
// This provides "logical deletion" while respecting blockchain immutability
async function searchLearnings(query: string): Promise<Learning[]> {
  const results = await fetchFromIPFS(query);

  // Filter out revoked content (user-requested deletions)
  const filtered = [];
  for (const result of results) {
    if (!await isRevoked(result.ipfsCid)) {
      filtered.push(result);
    }
  }

  return filtered;
}

// Note: Content remains on IPFS/blockchain but our application excludes it
// This balances immutability with user privacy rights
```

### Future Celestia Integration

Post-MVP path to add Celestia:

```typescript
// Phase 1: IPFS + Base (MVP)
upload → IPFS → Base contract

// Phase 2: Add Celestia DA layer
upload → IPFS (content) → Celestia (DA blob) → Base contract (CID + Celestia commitment)

// Celestia stores blob commitment, Base stores both CIDs
interface UploadV2 {
  ipfsCid: string;
  celestiaCommitment: string; // Celestia blob commitment
  celestiaHeight: number;     // Block height
  baseContractTx: string;     // Base L2 transaction
}
```

## Risks and Mitigations

### Risk: Immutability vs Right-to-Delete (GDPR)

**Impact**: High - Legal compliance issue

**Mitigation**:
- Only upload derived learnings (never raw conversations)
- Explicit consent with "permanent upload" warning (STANDARDS.md #16)
- Revocation list for logical deletion (application-level filtering)
- License clarity (CC-BY-4.0 = permissive but attributed)
- Document that learnings are privacy-safe by design
- **Legal consultation recommended** before production deployment for GDPR/CCPA validation
- **Post-MVP**: Consider legal review of revocation list approach for compliance certification

### Risk: Pinning Service Failure

**Impact**: Medium - Content becomes inaccessible

**Mitigation**:
- Use multiple pinning services (Pinata + Web3.Storage)
- Local IPFS node as primary
- Monitor pin status
- Alert if unpinned
- Re-pin automatically if detected

### Risk: Base L2 Gas Spikes

**Impact**: Low - Upload costs increase

**Mitigation**:
- Base historically very stable (~$0.01)
- Batch uploads if needed
- Queue uploads during low-fee periods
- Switch to cheaper L2 if sustained spike
- Most uploads are async (can wait)

### Risk: IPFS Gateway Downtime

**Impact**: Medium - Queries fail

**Mitigation**:
- Multi-gateway fallback strategy
- Local IPFS node for queries
- Cache frequently accessed learnings
- Retry logic with exponential backoff
- Monitor gateway health

### Risk: Smart Contract Bugs

**Impact**: High - Could lose provenance data

**Mitigation**:
- Minimal contract (simple upload registry)
- Audit before mainnet deployment
- Use OpenZeppelin libraries
- Testnet validation
- Upgrade mechanism (proxy pattern)
- Limited funds at risk (no token treasury in MVP)

### Risk: Privacy Violation (Uploading Raw Data)

**Impact**: Critical - Core privacy guarantee violated

**Mitigation**:
- Code-level validation (reject raw conversations)
- Manual approval shows preview
- Audit logs of all uploads
- Canary tests (attempt to upload PII, should fail)
- Clear documentation and warnings

## Related Documents

### Architecture
- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Learning Extraction](../architecture/architecture-learning-extraction-2025-01-16.md)

### Decisions
- [ADR-004: Sanitize Before Storage](./decision-sanitize-before-storage-2025-01-16.md)
- [ADR-006: Async Processing Model](./decision-async-processing-model-2025-01-16.md)

### Plans
- [Original User Vision](../plans/plan-original-user-vision-2025-01-16.md)

### Standards
- [Section 15: Blockchain Standard](../STANDARDS.md#15-blockchain-standard-clarified)

### Reviews
- [GPT-5 Holistic Review](../reviews/gpt5-holistic-review-2025-01-16.txt)

---

## Implementation Checklist

- [ ] Set up local IPFS node
- [ ] Configure Pinata/Web3.Storage accounts
- [ ] Deploy LearningRegistry contract to Base testnet
- [ ] Test upload flow end-to-end
- [ ] Implement multi-gateway query fallback
- [ ] Add upload approval UI/CLI
- [ ] Create revocation list mechanism
- [ ] Write integration tests
- [ ] Document deployment process
- [ ] Audit contract (post-MVP, pre-mainnet)

---

*This ADR addresses the external review feedback noting the missing decision on IPFS + blockchain architecture. It clarifies the separation between Celestia (DA layer) and EVM chains (smart contracts), specifies Base as the concrete L2 choice, and ensures only derived learnings are uploaded to maintain privacy guarantees.*
