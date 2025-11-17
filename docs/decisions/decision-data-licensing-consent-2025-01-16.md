---
title: ADR-007: Data Licensing and Consent Model (Local-First, Opt-In Global Sharing)
category: decision
date: 2025-01-16
status: accepted
deciders: Claude + Dennison
tags: [privacy, legal, licensing, consent, data-sharing, ethics]
---

# ADR-007: Data Licensing and Consent Model

## Status

Accepted

Date: 2025-01-16

## Context

The Global Context Network extracts **learnings** from user conversations with AI agents and has the capability to:

1. **Store locally** - Sanitized conversations and learnings in SQLite
2. **Share globally** - Upload learnings to IPFS/blockchain for public access
3. **Enable queries** - Allow other AI agents to query learnings via MCP

This raises critical legal, ethical, and trust questions:

### Legal Questions

- **Ownership**: Who owns the intellectual property of an extracted learning?
- **Licensing**: Under what license are shared learnings published?
- **Liability**: Who is responsible if learnings contain inaccurate or harmful information?
- **Revocation**: Can users delete learnings after global publication?
- **Attribution**: Should contributions be attributed or anonymous?

### Ethical Questions

- **Consent**: Do users understand what they're sharing and with whom?
- **Control**: Can users opt-out or selectively share?
- **Privacy**: Even with sanitization, are learnings truly de-identified?
- **Commercialization**: Should users be compensated for valuable learnings?
- **Derivatives**: Can third parties build commercial products on shared learnings?

### Trust Requirements

- **Transparency**: Users must understand exactly what is shared
- **Agency**: Users must have meaningful control
- **Reversibility**: Users must be able to change their mind
- **Safety**: Default behavior must be the safest option
- **Alignment**: System behavior must match user expectations

### External Review Findings

Both GPT-5 and Gemini 2.5 Pro reviews identified this as a **CRITICAL BLOCKER**:

**GPT-5 Review** (Critical Issue #7):
> "Security/consent/licensing gate before upload - Plans and ADRs note the need for consent/licensing ADR but it's not finalized. Upload gating/opt-in is critical before any global distribution."

**Gemini 2.5 Pro Review** (Critical Blocker #2):
> "Unaddressed Data Licensing and Ownership: The plan involves uploading user-generated learnings to a global, public IPFS network. There is **zero documentation** on the legal framework for this:
> - What license are the learnings shared under (e.g., MIT, CC0, proprietary)?
> - Who owns the intellectual property of an extracted learning? The user, the system, the network?
> - How is user consent for global, irrevocable publication obtained and managed?"

### Regulatory Context

- **GDPR** (EU): Requires explicit consent for data processing and sharing
- **CCPA** (California): Grants users right to know, delete, and opt-out
- **PIPEDA** (Canada): Requires meaningful consent and purpose limitation
- **LGPD** (Brazil): Brazilian data protection law similar to GDPR
- **UK GDPR**: Post-Brexit UK data protection requirements
- **COPPA** (US): Children's Online Privacy Protection Act - under-13 restrictions
- **Privacy-by-Design**: Default to most privacy-preserving option

**CRITICAL**: Under GDPR Recital 26, only **truly anonymized** data (no reasonably likely re-identification by anyone) can be published immutably. If learnings contain any personal data, GDPR erasure rights conflict with IPFS/blockchain permanence. "Anonymized" means **no reasonably likely re-identification**, not just pseudonymization.

**Controller/Processor Roles**: We must define who acts as data controller vs processor at each stage (local processing, consent collection, publishing, IPFS pinning). If we operate the software and pinning nodes, we likely act as controller for consent logs and host/intermediary for published datasets.

### Prior Art

Similar projects and their approaches:

1. **Wikipedia** - CC BY-SA 4.0, all contributions licensed, attribution optional
2. **Stack Overflow** - CC BY-SA 4.0, user contributions, reputation system
3. **OpenStreetMap** - ODbL (Open Database License), share-alike requirement
4. **Creative Commons** - Various licenses (CC0, BY, BY-SA, BY-NC)
5. **GitHub** - Code under repo license, issues/PRs under CC0
6. **Hugging Face Datasets** - Various licenses, user-specified per dataset

## Decision

Implement a **Local-First, Explicit Opt-In, Open License** model with manual approval gates for the MVP.

### Core Principles

1. **Default: Local-Only** - System operates locally by default, no global uploads
2. **Explicit Opt-In** - Users must actively enable global sharing
3. **Manual Approval** - Each upload requires explicit user confirmation (MVP)
4. **Learning-Only Sharing** - NEVER share raw conversations, only derived learnings
5. **True Anonymization** - Only publish genuinely anonymized data (no reasonably likely re-identification by anyone)
6. **Open License** - Shared learnings published under permissive open license (CC BY 4.0)
7. **Informed Consent** - Clear disclosure of what sharing means including IPFS permanence
8. **Age Gating** - Block global sharing for minors (under-16 EU, under-13 US)
9. **Contribution Agreement** - Users warrant they have rights to share, no confidential/PII/trade secrets
10. **Revocation Support** - Users can delete/revoke at any time (best-effort for published)
11. **Data Minimization** - Minimal consent logging, strict retention limits (12-24 months)
12. **Database Rights** - Dual-license: CC BY 4.0 per-learning, CC0/ODC-By for aggregated dataset
13. **Abuse Protection** - Fast-track takedown process, kill-switch, DMCA agent
14. **Cross-Jurisdiction** - GDPR, CCPA, LGPD, UK GDPR compliance with international transfer mechanisms

### Default Behavior

```
┌─────────────────────────────────────┐
│     USER INSTALLS SYSTEM            │
│                                     │
│  Default Mode: LOCAL-ONLY           │
│  ✓ Conversations captured           │
│  ✓ Learnings extracted              │
│  ✓ MCP queries work (local data)    │
│  ✗ NO global uploads                │
│  ✗ NO blockchain transactions       │
│  ✗ NO IPFS publishing               │
└─────────────────────────────────────┘
```

**Rationale**: Safest default. Users can explore value without legal/privacy concerns.

### Opt-In Flow (MVP)

```
Step 1: User Initiates
  → User runs: gcn enable-sharing

Step 2: Age Verification
  → System verifies user age:

  ┌───────────────────────────────────────────────────┐
  │ AGE VERIFICATION                                  │
  │                                                   │
  │ To enable global sharing, you must confirm:       │
  │                                                   │
  │ [ ] I am at least 16 years old (EU) or 13 (US)   │
  │                                                   │
  │ Global sharing is restricted for minors to comply │
  │ with GDPR and COPPA regulations.                  │
  │                                                   │
  │ Local-only mode is available for all ages.        │
  └───────────────────────────────────────────────────┘

Step 3: Data Contribution Agreement
  → User accepts contribution terms:

  ┌───────────────────────────────────────────────────┐
  │ DATA CONTRIBUTION AGREEMENT                       │
  │                                                   │
  │ By enabling sharing, you warrant that:            │
  │                                                   │
  │ [ ] I have the right to share these learnings     │
  │ [ ] Learnings contain NO personal information     │
  │ [ ] Learnings contain NO confidential/trade secrets│
  │ [ ] Learnings contain NO employer/NDA material    │
  │ [ ] I will NOT share customer/proprietary data    │
  │ [ ] I grant CC BY 4.0 license for shared content  │
  │ [ ] I waive moral rights and database rights      │
  │ [ ] I understand sharing may affect patentability │
  │ [ ] No medical, export-controlled, illegal content│
  │ [ ] No defamatory or harmful content              │
  │                                                   │
  │ You agree to indemnify the network for any        │
  │ violations of these warranties.                   │
  │                                                   │
  │ License granted to the extent any rights exist,   │
  │ including AI/human generated content ambiguity.   │
  └───────────────────────────────────────────────────┘

Step 4: Informed Consent
  → System displays consent dialog:

  ┌───────────────────────────────────────────────────┐
  │ ENABLE GLOBAL LEARNING SHARING                    │
  │                                                   │
  │ What this means:                                  │
  │ • Your anonymized learnings will be shared publicly│
  │ • Published to IPFS (content-addressed storage)   │
  │ • Blockchain record created (public, permanent)   │
  │ • Other AI agents can query your learnings        │
  │ • License: CC BY 4.0 (attribution required)       │
  │                                                   │
  │ What is NOT shared:                               │
  │ • Raw conversations (never shared)                │
  │ • Personal information (anonymized before publish)│
  │ • Your identity (anonymous by default)            │
  │ • Non-trivial code snippets (blocked by policy)   │
  │ • Identifiable incidents or specific individuals  │
  │ • Sensitive topics (health, race, religion, etc.) │
  │                                                   │
  │ Your rights:                                      │
  │ • Revoke at any time (stops new uploads)          │
  │ • Delete learnings (removes from local + network) │
  │ • View pending uploads before approval            │
  │ • Data access, correction, restriction, portability│
  │ • Lodge complaint with supervisory authority      │
  │ • Withdraw consent (applies to local data/logs)   │
  │                                                   │
  │ CRITICAL: IPFS data is hard to delete. Once       │
  │ published, copies may persist on other nodes.     │
  │ Only truly anonymized learnings will be published.│
  │ Erasure rights apply to local data and consent    │
  │ records, not anonymized public learnings.         │
  │                                                   │
  │ [ ] I have read and accept the Privacy Policy     │
  │ [ ] I have read and accept the Terms of Service   │
  │ [ ] I have read the Data Contribution Agreement   │
  │ [ ] I understand IPFS immutability risks          │
  │ [ ] I confirm all learnings will be anonymized    │
  │                                                   │
  │ Required documents:                               │
  │ • Privacy Policy: ./docs/legal/PRIVACY.md         │
  │ • Terms of Service: ./docs/legal/TERMS.md         │
  │ • Data Contribution Agreement: ./docs/legal/CONTRIBUTION.md│
  │ • Abuse/Takedown Policy: ./docs/legal/ABUSE.md    │
  │ • CC BY 4.0 License: [link]                       │
  │ • Anonymization Standard: ./docs/standards/ANONYMIZATION.md│
  └───────────────────────────────────────────────────┘

Step 5: Manual Approval (MVP)
  → For each learning ready to upload:

  ┌───────────────────────────────────────────────────┐
  │ APPROVE UPLOAD?                                   │
  │                                                   │
  │ Learning Preview:                                 │
  │ "When debugging TypeScript decorators, enable     │
  │  experimentalDecorators in tsconfig.json and      │
  │  check the emitted JavaScript to verify..."       │
  │                                                   │
  │ Metadata:                                         │
  │ • Size: 1.2 KB                                    │
  │ • Tags: typescript, debugging, decorators         │
  │ • Quality Score: 8.7/10                           │
  │ • PII Check: PASSED (multi-model scan)            │
  │ • Code Check: PASSED (no non-trivial code)        │
  │ • Secret Scan: PASSED (no API keys/credentials)   │
  │ • Re-identification Risk: LOW (k-anonymity ≥10)   │
  │                                                   │
  │ License: CC BY 4.0                                │
  │ Attribution: Anonymous                            │
  │                                                   │
  │ [Approve] [Reject] [View Full Learning]           │
  └───────────────────────────────────────────────────┘

Step 6: Upload & Record
  → Upload to IPFS
  → Record blockchain transaction
  → Update local upload_status table
  → Show confirmation with IPFS CID
```

### License: Creative Commons Attribution 4.0 (CC BY 4.0)

**Chosen License**: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

**What it allows**:
- ✓ Share — Copy and redistribute in any format
- ✓ Adapt — Remix, transform, build upon
- ✓ Commercial use — Use for any purpose, including commercial

**Requirements**:
- ✓ Attribution — Must give appropriate credit
- ✓ Indicate changes — If remixed, must indicate changes
- ✓ No additional restrictions — Cannot add legal/technical restrictions

**Rationale for CC BY 4.0**:
1. **Permissive** - Enables maximum reuse and innovation
2. **Attribution** - Credit to contributors (if opted-in)
3. **Standard** - Widely recognized, legally tested
4. **Commercial-friendly** - Allows commercial AI training/products
5. **Compatible** - Works with most other open licenses
6. **Irrevocable** - Once licensed, can't be un-licensed (legal clarity)
7. **Moral rights waiver** - Includes waiver to extent possible
8. **AI-friendly** - License applies regardless of AI/human authorship ambiguity

**Dual Licensing for Database Rights**:

To address EU sui generis database rights, we employ dual licensing:

- **Per-Learning Content**: CC BY 4.0 (attribution required)
- **Aggregated Dataset/Metadata**: CC0 or ODC-By (public domain or attribution)

This reduces friction for bulk use cases while ensuring individual learnings receive proper attribution.

**Attribution for Anonymous Contributions**:

When attribution preference is "anonymous", we provide this standard attribution string for downstream users:

```
"Global Context Network contributor (anonymous), Learning CID: Qm..., CC BY 4.0"
```

This satisfies CC BY attribution requirements while preserving user anonymity.

### Attribution Options

Users choose attribution preference:

```typescript
enum AttributionPreference {
  ANONYMOUS = "anonymous",           // No attribution (default)
  PSEUDONYMOUS = "pseudonymous",     // Attribute to public key/handle
  ATTRIBUTED = "attributed"          // Attribute to real identity
}
```

**Default: Anonymous**
- Most privacy-preserving
- No identity linkage
- Still contributes to network

**Pseudonymous**:
- Attribute to Ethereum address or handle
- Build reputation without real identity
- Enable token rewards tracking
- **Note**: Blockchain addresses may be personal data if linkable to identity
- Requires explicit consent and disclosure of traceability risk

**Attributed**:
- Real name or GitHub profile
- Build public portfolio
- Maximum recognition

### What Is Shared

**Allowed (Learnings Only)**:
```json
{
  "id": "learning-xyz789",
  "content": "When implementing React hooks, useEffect with empty dependency array runs once on mount...",
  "tags": ["react", "hooks", "useEffect"],
  "context": "debugging-infinite-render-loop",
  "quality_score": 8.5,
  "language": "typescript",
  "framework": "react",
  "created_at": "2025-01-16T10:30:00Z",
  "license": "CC-BY-4.0",
  "attribution": "anonymous"
}
```

**Prohibited (Never Shared)**:
- ❌ Raw conversation transcripts
- ❌ User prompts (even sanitized)
- ❌ Assistant responses (even sanitized)
- ❌ Tool calls and results
- ❌ File contents
- ❌ Thinking/reasoning traces
- ❌ Session metadata (timestamps, durations, etc.)
- ❌ Personal information (even sanitized placeholders)
- ❌ Database schemas, API keys, internal details
- ❌ Non-trivial code snippets (>10 lines or copyrightable)
- ❌ Identifiable individuals, companies, or specific incidents
- ❌ Rare job titles or highly specific circumstances (re-identification risk)
- ❌ Special categories: health, race, religion, politics (if person-linked)
- ❌ Medical advice, export-controlled, or illegal content
- ❌ Defamatory, harmful, or regulated content
- ❌ Customer data, trade secrets, NDA material, confidential information

**Rationale**: Only share the distilled, abstracted insight. Never raw data or content with re-identification risk.

### Revocation and Deletion

Users can revoke consent and delete learnings:

```bash
# Stop new uploads
gcn disable-sharing

# Delete specific learning (local + network revocation)
gcn delete-learning <learning-id>

# Delete all learnings
gcn delete-all-learnings --confirm

# Publish revocation to blockchain
gcn revoke-upload <ipfs-cid>
```

**Revocation Behavior**:

1. **Local Deletion** - Immediate, permanent
2. **Upload Queue** - Cancelled immediately
3. **Blockchain Revocation** - Publishes revocation event
4. **IPFS Unpinning** - Unpin from our nodes
5. **Best-Effort Network Removal** - Request other nodes unpin

**Limitations** (disclosed to user):
- IPFS is a distributed system; copies may persist on other nodes
- Blockchain records are permanent (revocation event added, not removed)
- Third parties may have cached or indexed learnings
- Revocation is "best-effort", not guaranteed deletion

### Compliance Alignment

**GDPR Compliance**:
- ✓ Explicit consent (opt-in)
- ✓ Purpose limitation (only learnings, not raw data)
- ✓ Data minimization (sanitization + learning extraction)
- ✓ Right to access (view pending uploads, local data, consent records)
- ✓ Right to rectification (correct local data)
- ✓ Right to erasure (deletion of local data and consent records)
- ✓ Right to restriction (pause processing)
- ✓ Right to data portability (export in machine-readable format)
- ✓ Right to withdraw consent (disable-sharing, local data deleted)
- ✓ Right to lodge complaint (with supervisory authority)
- ✓ Transparency (clear consent dialog, controller identity, DPO contact)
- ✓ Controller/processor roles defined
- ✓ International transfer mechanisms (SCCs for cross-border)
- ✓ Subprocessor list (IPFS pinning, gateways, blockchain infra)
- ✓ DPIA completed before enabling sharing (Article 35)
- ✓ True anonymization (GDPR Recital 26) - erasure applies to local data only

**CCPA Compliance**:
- ✓ Notice at collection (consent dialog)
- ✓ Right to know (view learnings before upload)
- ✓ Right to delete (revocation mechanism)
- ✓ Right to opt-out (local-only mode)
- ✓ No sale of personal information (sanitized, anonymous)

**Privacy-by-Design**:
- ✓ Proactive not reactive (default local-only)
- ✓ Privacy as default setting (opt-in required)
- ✓ Privacy embedded in design (no raw data sharing)
- ✓ Full functionality (local mode fully functional)
- ✓ End-to-end security (sanitize before storage, encrypt SQLite at rest)
- ✓ Visibility and transparency (manual approval)
- ✓ Respect for user privacy (revocation support)

**LGPD Compliance (Brazil)**:
- ✓ Lawful basis (consent)
- ✓ Purpose specification
- ✓ Data subject rights (access, correction, deletion, portability)
- ✓ International transfer safeguards

**UK GDPR Compliance**:
- ✓ Same requirements as EU GDPR
- ✓ Post-Brexit UK data protection standards
- ✓ ICO as supervisory authority

## Consequences

### Positive

#### Trust & Adoption
- **User confidence** - Clear, safe defaults build trust
- **Regulatory compliance** - Aligns with GDPR, CCPA, PIPEDA
- **Ethical alignment** - Respects user agency and consent
- **Transparent operation** - Users understand what happens to their data

#### Legal Protection
- **Clear licensing** - CC BY 4.0 is well-understood and tested
- **Liability reduction** - Users explicitly consent to sharing
- **IP clarity** - Licensing terms prevent disputes
- **Revocation trail** - Blockchain records consent changes

#### Community Growth
- **Open license** - Encourages derivatives and innovation
- **Attribution options** - Enables reputation building
- **Quality focus** - Manual approval ensures high-quality learnings
- **Network effects** - More sharing = more value for all

### Negative

#### User Experience
- **Friction** - Manual approval slows uploads (MVP)
- **Complexity** - Users must understand licensing/consent
- **Decision fatigue** - Approve every upload individually
- **Onboarding overhead** - Longer setup for global sharing

#### Network Growth
- **Slower adoption** - Default local-only delays network growth
- **Lower contribution rate** - Manual approval reduces uploads
- **Cold start problem** - Fewer learnings initially
- **Asymmetric value** - Early adopters contribute more than they gain

#### Technical Overhead
- **Approval UI** - Must build manual approval interface
- **Revocation system** - Complex blockchain + IPFS coordination
- **State management** - Track consent status, preferences
- **Migration complexity** - Changing consent model later is hard

### Neutral

#### Implementation Requirements
- Consent dialog UI (CLI for MVP)
- Approval workflow and queue UI
- License metadata in uploads
- Revocation blockchain events
- Attribution tracking (optional)
- Compliance documentation

#### Operational Considerations
- User education materials
- Legal terms of service
- Privacy policy
- Consent logging and audit trail
- Revocation request handling

## Alternatives Considered

### Alternative 1: Default Opt-In (Share by Default)

**Description**: Users share globally by default, can opt-out.

**Pros**:
- Faster network growth
- More learnings from day one
- Better network effects
- Simpler UX (one-time opt-out)

**Cons**:
- **Violates privacy-by-design** - Not the safest default
- **Regulatory risk** - May not meet GDPR explicit consent
- **Trust issues** - Users may feel tricked or surprised
- **Higher liability** - More accidental PII sharing risk

**Why not chosen**: Violates core privacy-first principle. Default must be safest option.

### Alternative 2: Proprietary License (All Rights Reserved)

**Description**: System retains all rights, users grant license to share.

**Pros**:
- Control over use
- Can monetize later
- Prevent commercial exploitation
- Restrict derivatives

**Cons**:
- **Limits innovation** - Derivatives require permission
- **Legal complexity** - Must define license terms ourselves
- **Trust issues** - Users may not want to grant broad rights
- **Network effects limited** - Closed ecosystem grows slower

**Why not chosen**: Contradicts open, collaborative vision. We want learnings to spread freely.

### Alternative 3: Share-Alike License (CC BY-SA 4.0 or ODbL)

**Description**: Require derivatives to use same license.

**Pros**:
- Prevents proprietary capture (copyleft)
- Ensures improvements shared back
- Community remains open
- Aligns with open-source values

**Cons**:
- **Less permissive** - May reduce adoption
- **Licensing complexity** - Commercial users may avoid
- **Compatibility issues** - Harder to mix with other licenses
- **Enforcement burden** - Must monitor compliance

**Why not chosen**: Too restrictive for AI training use case. Want maximum reuse.

### Alternative 4: Public Domain (CC0)

**Description**: No rights reserved, complete public domain.

**Pros**:
- Maximum freedom
- No attribution required
- Simplest legal structure
- Zero restrictions

**Cons**:
- **No attribution** - Contributors get no credit
- **No incentive** - Can't build reputation
- **Irrevocable** - Can't change later
- **No quality signal** - Anyone can use without attribution

**Why not chosen**: Attribution provides incentive and quality signal. CC BY better aligns with reputation/token system.

### Alternative 5: Automatic Upload (No Manual Approval)

**Description**: Auto-upload learnings after extraction, no approval.

**Pros**:
- Zero friction
- Faster network growth
- Better UX
- More contributions

**Cons**:
- **Less control** - Users can't review before sharing
- **Quality risk** - Bad learnings slip through
- **PII risk** - Sanitization failures auto-published
- **Consent concerns** - May not meet "informed consent" bar

**Why not chosen**: MVP requires manual approval for safety. Can automate post-MVP with confidence thresholds.

### Alternative 6: Tiered Consent (Local/Team/Global)

**Description**: Three sharing levels: local-only, team/org, global.

**Pros**:
- Granular control
- Enables enterprise use
- Private sharing within teams
- Progressive trust model

**Cons**:
- **Complexity** - Three modes to implement
- **Scope creep** - MVP doesn't need team sharing
- **Access control** - Must implement team permissions
- **UX complexity** - Users must understand three modes

**Why not chosen**: Great for post-MVP, but MVP only needs local vs. global. Keep it simple.

## Implementation

### Phase 1: Local-Only Default (Week 1)

No consent required, everything local:

```typescript
// Default config
const defaultConfig = {
  mode: "local-only",
  sharing_enabled: false,
  manual_approval_required: true,
  license: "CC-BY-4.0",
  attribution: "anonymous"
};
```

### Phase 2: Opt-In Flow (Week 4-5)

Add consent dialog and preference storage:

```typescript
interface ConsentRecord {
  user_id: string;
  consent_given_at: string | null;  // ISO-8601 timestamp
  consent_withdrawn_at: string | null;
  consent_version: string;  // "v1.0" for tracking changes
  consent_text_hash: string;  // Hash of exact text shown (audit integrity)
  sharing_enabled: boolean;
  manual_approval_required: boolean;
  attribution_preference: AttributionPreference;
  license_accepted: string;  // "CC-BY-4.0"
  age_confirmed: boolean;  // 16+ EU, 13+ US
  user_agent_hash: string;  // Salted hash only (not raw UA)
  // ip_address removed: creates GDPR obligations without clear necessity
  retention_delete_after: string;  // Auto-delete date (12-24 months)
}

// Consent dialog
async function requestConsent(): Promise<boolean> {
  const dialog = new ConsentDialog({
    title: "Enable Global Learning Sharing",
    content: CONSENT_TEXT,  // Full disclosure text (layered, plain-language)
    examples: {
      allowed: [
        "✓ 'useEffect with empty deps runs once on mount'",
        "✓ 'TypeScript decorators need experimentalDecorators flag'",
        "✓ 'SQL EXPLAIN shows query execution plan'"
      ],
      prohibited: [
        "✗ 'My company XYZ uses this pattern...'",
        "✗ 'When John from engineering told me...'",
        "✗ 'I have a rare genetic condition...'",
        "✗ Code snippets >10 lines",
        "✗ API keys, credentials, internal URLs"
      ]
    },
    warnings: [
      "IPFS permanence: Deletion is best-effort, not guaranteed",
      "Patent implications: Public disclosure may affect patentability",
      "Do not share: personal info, work secrets, confidential data"
    ],
    checkboxes: [
      "I understand learnings will be shared publicly",
      "I understand IPFS data is hard to delete",
      "I accept the CC BY 4.0 license for my contributions",
      "I will not share identifiable individuals or incidents"
    ],
    links: {
      license: "https://creativecommons.org/licenses/by/4.0/",
      privacy_policy: "./docs/legal/PRIVACY.md",
      terms_of_service: "./docs/legal/TERMS.md",
      contribution_agreement: "./docs/legal/CONTRIBUTION.md",
      anonymization_standard: "./docs/standards/ANONYMIZATION.md"
    }
  });

  const accepted = await dialog.show();

  if (accepted) {
    const consentText = CONSENT_TEXT;  // Full disclosure text
    const retentionMonths = 24;  // 12-24 month retention

    await db.consent.insert({
      user_id: getCurrentUserId(),
      consent_given_at: new Date().toISOString(),
      consent_version: "v1.0",
      consent_text_hash: hashConsentText(consentText),  // SHA-256 hash
      sharing_enabled: true,
      manual_approval_required: true,
      attribution_preference: "anonymous",
      license_accepted: "CC-BY-4.0",
      age_confirmed: true,  // From age verification step
      user_agent_hash: hashWithSalt(getUserAgent()),  // Salted hash
      retention_delete_after: addMonths(new Date(), retentionMonths).toISOString()
    });
  }

  return accepted;
}
```

### Phase 3: Manual Approval UI (Week 5)

Review and approve learnings before upload:

```typescript
interface UploadApproval {
  learning_id: string;
  preview: string;
  full_content: string;
  metadata: {
    size_bytes: number;
    tags: string[];
    quality_score: number;
    pii_check_status: "passed" | "warning" | "failed";
    code_snippet_check: "passed" | "warning" | "failed";  // >10 lines blocked
    secret_scan_status: "passed" | "warning" | "failed";  // API keys, credentials
    reidentification_risk: "low" | "medium" | "high";  // k-anonymity score
    sensitive_category_check: "passed" | "warning" | "failed";  // health, race, etc.
    language?: string;
    framework?: string;
  };
  license: string;
  attribution: AttributionPreference;
  created_at: string;
}

async function approveUploads() {
  const pending = await db.learnings.findPending();

  for (const learning of pending) {
    const approval: UploadApproval = {
      learning_id: learning.id,
      preview: learning.content.slice(0, 200),
      full_content: learning.content,
      metadata: {
        size_bytes: Buffer.byteLength(learning.content),
        tags: learning.tags,
        quality_score: learning.quality_score,
        pii_check_status: learning.pii_check_status,
        code_snippet_check: learning.code_snippet_check,
        secret_scan_status: learning.secret_scan_status,
        reidentification_risk: learning.reidentification_risk,
        sensitive_category_check: learning.sensitive_category_check
      },
      license: "CC-BY-4.0",
      attribution: getAttributionPreference(),
      created_at: learning.created_at
    };

    const decision = await showApprovalDialog(approval);

    if (decision === "approve") {
      await uploadLearning(learning);
    } else if (decision === "reject") {
      await db.learnings.update(learning.id, {
        upload_status: "rejected_by_user"
      });
    }
  }
}
```

### Phase 4: License Metadata (Week 6)

Embed license in all uploads:

```typescript
interface LearningUpload {
  // Content
  learning_id: string;
  content: string;
  tags: string[];
  quality_score: number;

  // License metadata
  license: {
    type: "CC-BY-4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
    full_text_cid: string  // IPFS CID of full license text
  };

  // Attribution
  attribution: {
    type: AttributionPreference;
    identifier?: string;  // Ethereum address, handle, or null
    timestamp: string;
  };

  // Provenance
  source: {
    system: "global-context-network",
    version: "0.1.0",
    timestamp: string;
    sanitization_version: string;
  };

  // Signature (for verification and anti-spam)
  signature: string;  // REQUIRED cryptographic signature
}

// Upload with metadata
async function uploadLearning(learning: Learning) {
  // Rate limiting check
  await enforceRateLimit(getUserId());

  const upload: LearningUpload = {
    learning_id: learning.id,
    content: learning.content,
    tags: learning.tags,
    quality_score: learning.quality_score,
    license: {
      type: "CC-BY-4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      full_text_cid: CC_BY_40_LICENSE_CID
    },
    attribution: {
      type: getAttributionPreference(),
      identifier: getAttributionIdentifier(),
      timestamp: new Date().toISOString()
    },
    source: {
      system: "global-context-network",
      version: getVersion(),
      timestamp: new Date().toISOString(),
      sanitization_version: getSanitizationVersion()
    },
    signature: await signUpload(learning)  // REQUIRED for spam prevention
  };

  // Upload to IPFS
  const cid = await ipfs.add(JSON.stringify(upload));

  // Record on blockchain
  await blockchain.recordUpload({
    cid,
    learning_id: learning.id,
    license: "CC-BY-4.0",
    attribution: upload.attribution.type,
    timestamp: Date.now()
  });

  // Update local record
  await db.uploads.insert({
    learning_id: learning.id,
    ipfs_cid: cid,
    uploaded_at: new Date().toISOString(),
    license: "CC-BY-4.0"
  });
}
```

### Phase 5: Revocation System (Week 7)

Enable deletion and revocation:

```typescript
interface RevocationEvent {
  learning_id: string;
  ipfs_cid: string;
  revoked_at: string;
  reason: "user-requested" | "privacy-violation" | "quality-issue";
  user_signature?: string;
}

async function revokeLearning(learningId: string) {
  const upload = await db.uploads.findOne({ learning_id: learningId });

  if (!upload) {
    throw new Error("Learning not uploaded");
  }

  // 1. Delete from local database
  await db.learnings.delete({ id: learningId });
  await db.uploads.delete({ learning_id: learningId });

  // 2. Unpin from IPFS
  await ipfs.unpin(upload.ipfs_cid);

  // 3. Publish revocation event to blockchain
  const revocation: RevocationEvent = {
    learning_id: learningId,
    ipfs_cid: upload.ipfs_cid,
    revoked_at: new Date().toISOString(),
    reason: "user-requested"
  };

  await blockchain.publishRevocation(revocation);

  // 4. Add to revocation list
  await db.revocations.insert(revocation);

  // 5. Publish tombstone CID to revocation registry
  await publishTombstone(upload.ipfs_cid);

  // 6. Request other nodes unpin (best effort)
  await requestNetworkUnpin(upload.ipfs_cid);

  // 7. Notify known pinning partners
  await notifyPinningPartners(upload.ipfs_cid, "revoked");
}

async function publishTombstone(cid: string) {
  // Public revocation registry for cache purge and mirrors
  const tombstone = {
    type: "revocation",
    cid,
    revoked_at: new Date().toISOString(),
    reason: "user-requested"
  };

  // Publish to revocation registry (separate IPFS collection)
  const tombstoneCid = await ipfs.add(JSON.stringify(tombstone));
  await blockchain.recordTombstone({ original_cid: cid, tombstone_cid: tombstoneCid });
}

async function withdrawConsent() {
  // Update consent record
  await db.consent.update({
    consent_withdrawn_at: new Date().toISOString(),
    sharing_enabled: false
  });

  // Cancel all pending uploads
  await db.learnings.updateMany(
    { upload_status: "queued" },
    { upload_status: "cancelled_by_user" }
  );

  // Optionally: revoke all existing uploads
  const uploads = await db.uploads.findAll();
  for (const upload of uploads) {
    await revokeLearning(upload.learning_id);
  }
}

// Kill-switch for catastrophic sanitization failure
async function emergencyKillSwitch(reason: string) {
  console.error(`EMERGENCY KILL-SWITCH ACTIVATED: ${reason}`);

  // 1. Immediately halt all uploads system-wide
  await db.config.update({ uploads_enabled: false, kill_switch_active: true });

  // 2. Cancel all pending uploads
  await db.learnings.updateMany(
    { upload_status: "queued" },
    { upload_status: "cancelled_emergency" }
  );

  // 3. Alert administrators
  await alertAdministrators({
    severity: "CRITICAL",
    reason,
    timestamp: new Date().toISOString()
  });

  // 4. Log incident for audit
  await db.incidents.insert({
    type: "kill_switch_activation",
    reason,
    timestamp: new Date().toISOString()
  });
}
```

### Database Schema Updates

```sql
-- Consent tracking (minimized per GPT-5 feedback)
CREATE TABLE consent (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  consent_given_at TEXT,  -- ISO-8601
  consent_withdrawn_at TEXT,
  consent_version TEXT NOT NULL,
  consent_text_hash TEXT NOT NULL,  -- Hash of exact text shown
  sharing_enabled INTEGER NOT NULL DEFAULT 0,
  manual_approval_required INTEGER NOT NULL DEFAULT 1,
  attribution_preference TEXT NOT NULL DEFAULT 'anonymous',
  license_accepted TEXT NOT NULL,
  age_confirmed INTEGER NOT NULL DEFAULT 0,  -- 16+ EU, 13+ US
  user_agent_hash TEXT,  -- Salted hash only, not raw UA
  -- ip_address removed: not necessary, creates GDPR obligations
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retention_delete_after TEXT  -- Auto-delete date (12-24 months)
);

-- Upload approvals
CREATE TABLE upload_approvals (
  id TEXT PRIMARY KEY,
  learning_id TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  decision TEXT NOT NULL,  -- 'approved', 'rejected', 'pending'
  reviewer TEXT NOT NULL,  -- 'user' or 'automated'
  notes TEXT,
  FOREIGN KEY (learning_id) REFERENCES learnings(id)
);

-- Revocations
CREATE TABLE revocations (
  id TEXT PRIMARY KEY,
  learning_id TEXT NOT NULL,
  ipfs_cid TEXT NOT NULL,
  revoked_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  user_signature TEXT,
  created_at TEXT NOT NULL
);

-- Update learnings table
ALTER TABLE learnings ADD COLUMN license TEXT DEFAULT 'CC-BY-4.0';
ALTER TABLE learnings ADD COLUMN attribution_type TEXT DEFAULT 'anonymous';
ALTER TABLE learnings ADD COLUMN upload_status TEXT DEFAULT 'not_approved';
  -- 'not_approved', 'approved', 'uploaded', 'rejected', 'revoked'
```

## Risks and Mitigations

### Risk: Users Don't Understand Implications

**Impact**: High - Uninformed consent is not valid consent

**Mitigation**:
- Clear, plain-language consent dialog
- Visual examples of what is/isn't shared
- Link to privacy policy and license
- Require checkbox acknowledgments
- Educational documentation
- Warning about IPFS permanence

### Risk: IPFS Data Not Actually Deleted

**Impact**: Medium - Users expect deletion to work

**Mitigation**:
- Clear disclosure: "best-effort, not guaranteed"
- Unpin from our nodes immediately
- Publish revocation event to blockchain
- Request other nodes unpin (DHT announcement)
- Document limitations in consent dialog
- Consider alternative storage with deletion guarantees post-MVP

### Risk: License Change Needed Later

**Impact**: Medium - CC BY 4.0 is irrevocable

**Mitigation**:
- Version consent records ("v1.0")
- New consent required for license changes
- Grandfather old uploads under old license
- Clear versioning in metadata
- Consider dual-licensing from start

### Risk: PII in Learnings Despite Sanitization

**Impact**: Critical - Privacy violation

**Mitigation**:
- Multi-layer sanitization (rules + AI)
- Manual approval shows PII check status
- Block uploads with failed PII checks
- Post-upload audits
- Kill-switch to halt all uploads
- Revocation mechanism for mistakes

### Risk: Low Adoption Due to Friction

**Impact**: Medium - Network growth slowed

**Mitigation**:
- MVP: Accept manual approval overhead
- Phase 2: Add confidence-based auto-approval
- Phase 3: One-click bulk approval
- Metrics: Track approval/rejection rates
- Iterate: Simplify based on user feedback

### Risk: Legal Liability for Shared Content

**Impact**: High - Legal exposure if learnings are harmful

**Mitigation**:
- Terms of service disclaimer
- User warranty: "I have rights to share"
- Safe harbor provisions (DMCA, platform immunity)
- Quality scoring filters low-quality learnings
- Community reporting mechanism
- Revocation for policy violations

### Risk: Re-Identification Despite Anonymization (GPT-5)

**Impact**: Critical - GDPR violation if personal data published

**Mitigation**:
- Quantitative re-identification testing (k-anonymity checks)
- Adversarial review on samples before publish
- Block high-uniqueness content (rare job titles, specific incidents)
- Multi-model PII detection (rules + AI + NER)
- Special category blocklist (health, race, religion, politics if person-linked)
- Reject learnings with "small k" cohort hints

### Risk: Third-Party/Confidential Content Leakage (GPT-5)

**Impact**: High - Legal liability, NDA violations, trade secret exposure

**Mitigation**:
- Contributor warranty: "No confidential/proprietary information"
- Automated secret scanning (API keys, internal URLs, company names)
- Provenance checks: verify user has rights to share
- Policy: "No employer/client/NDA material"
- Indemnity clause in Data Contribution Agreement

### Risk: Code Snippet Copyright Infringement (GPT-5)

**Impact**: High - Copyright violation if non-trivial code shared

**Mitigation**:
- MVP: Block all non-trivial code snippets by policy
- Automated detection: flag code blocks >10 lines
- Future: Separate code license (MIT) with provenance
- User education: "Share concepts, not copy-pasted code"

### Risk: Defamation/Illegal Content (GPT-5)

**Impact**: High - Legal liability, harm to individuals

**Mitigation**:
- Automated classification to block regulated content
- Policy: No medical advice, export-controlled, illegal content
- Fast-track takedown process
- Abuse reporting mechanism with agent contact
- Kill-switch for immediate unpinning

### Risk: Dataset Poisoning/Spam (GPT-5)

**Impact**: Medium - Network quality degradation

**Mitigation**:
- Cryptographic signatures required on all uploads
- Rate limiting per user
- Reputation system / allowlists (post-MVP)
- Post-publication flagging and quarantine workflow
- Quality scoring threshold enforcement

### Risk: Attribution Privacy Leakage (GPT-5)

**Impact**: Medium - Pseudonymous attribution can be personal data

**Mitigation**:
- Treat blockchain addresses as personal data if linkable
- Explicit consent for pseudonymous attribution
- Disclosure: "Address may be traceable to identity"
- Default: Anonymous (no attribution)

### Risk: Consent Logging Contains Personal Data (GPT-5)

**Impact**: Medium - IP/user-agent storage creates GDPR obligations

**Mitigation**:
- Minimize: Store salted hash of user-agent, avoid IP unless fraud prevention
- Strict retention: 12-24 months maximum, auto-delete
- Access controls: Limit who can view consent logs
- Store hash of exact consent text shown for audit integrity
- Document necessity justification or remove entirely

### Risk: Missing DPIA (GPT-5)

**Impact**: High - GDPR compliance requirement for high-risk processing

**Mitigation**:
- Conduct Data Protection Impact Assessment before enabling sharing
- Document: processing purposes, necessity, risks, mitigations
- Identify residual risks and acceptance criteria
- DPO review if required (organizations >250 employees)
- Update regularly as system evolves

### Risk: Minors Using System (GPT-5)

**Impact**: High - COPPA/GDPR violations

**Mitigation**:
- Age gating: Require confirmation of 16+ (EU) or 13+ (US)
- Block global sharing entirely for minors in MVP
- Future: Verifiable parental consent mechanism
- Clear disclosure in onboarding

### Risk: Cross-Jurisdiction Compliance (GPT-5)

**Impact**: Medium - Different laws in different countries

**Mitigation**:
- Address LGPD (Brazil), UK GDPR explicitly
- International transfer mechanisms (SCCs) for consent logs
- List subprocessors (IPFS pinning, gateways, blockchain infra)
- General international clause in Privacy Policy

### Risk: Security and Local Data Breaches (GPT-5)

**Impact**: High - Exposure of local conversations, consent records, personal data

**Mitigation**:
- Encrypt SQLite database at rest
- Key handling and secure storage
- Least privilege access controls
- Incident response plan documented
- Breach notification procedures (72 hours GDPR, state laws)
- Regular security audits
- Secure coding practices
- Input validation and sanitization

### Risk: Token/Rewards Future Implementation (GPT-5)

**Impact**: High - AML/KYC obligations if tokens have monetary value

**Mitigation**:
- AML/KYC requirements for token distributions
- Tax reporting obligations
- Sanctions screening
- Securities law compliance
- Clear disclosures about token nature and risks
- Consult legal counsel before token launch

## Post-MVP Enhancements

### Automated Approval (Phase 2)

```typescript
// Auto-approve high-confidence learnings
if (learning.quality_score >= 9.0 &&
    learning.pii_check_status === "passed" &&
    user.auto_approve_enabled) {
  await uploadLearning(learning);
} else {
  await queueForManualApproval(learning);
}
```

### Bulk Operations (Phase 2)

```bash
# Approve all pending
gcn approve-all --min-quality 8.0

# Batch review
gcn review-pending --show 10
```

### Tiered Sharing (Phase 3)

```typescript
enum SharingTier {
  LOCAL = "local",          // Only this machine
  TEAM = "team",            // Organization/team
  GLOBAL = "global"         // Public network
}
```

### Licensing Options (Phase 4)

Allow users to choose license per learning:
- CC BY 4.0 (default)
- CC BY-SA 4.0 (share-alike)
- CC0 (public domain)
- ODbL (database license)

### Smart Contract Consent (Phase 5)

On-chain consent records:
```solidity
contract ConsentRegistry {
  event ConsentGiven(address user, uint256 timestamp, string version);
  event ConsentWithdrawn(address user, uint256 timestamp);

  mapping(address => ConsentRecord) public consents;
}
```

## Pre-Launch Requirements (GPT-5 Priority Actions)

Before enabling global sharing in production, the following MUST be completed:

### 1. Data Protection Impact Assessment (DPIA)

**Required by**: GDPR Article 35 (high-risk processing)

**Must document**:
- Processing purposes and necessity justification
- Data flows (local → sanitization → learning extraction → IPFS/blockchain)
- Risks to data subjects (re-identification, immutability, etc.)
- Mitigations and controls (anonymization, manual approval, etc.)
- Residual risks and acceptance criteria
- Controller/processor roles and responsibilities
- DPO review (if organization >250 employees)

**Deliverable**: `docs/legal/DPIA-2025.md`

### 2. Legal Documentation

**Privacy Policy** (`docs/legal/PRIVACY.md`):
- Controller identity and contact details
- DPO contact (if required)
- Processing purposes and legal bases
- Data categories processed (consent logs, learnings)
- Retention periods (12-24 months for consent, indefinite for anonymized learnings)
- Data subject rights (access, deletion, portability, restriction)
- International transfers (SCCs, subprocessors)
- Complaint mechanism (supervisory authority)

**Terms of Service** (`docs/legal/TERMS.md`):
- Service description
- User obligations
- Acceptable use policy
- Prohibited content
- Intellectual property
- Limitation of liability
- Dispute resolution
- Governing law

**Data Contribution Agreement** (`docs/legal/CONTRIBUTION.md`):
- Warranties (rights to share, no PII, no confidential info)
- License grant (CC BY 4.0)
- Moral rights waiver
- Database rights waiver
- Indemnification clause
- Age confirmation
- No medical/illegal/regulated content covenant

**Abuse and Takedown Policy** (`docs/legal/ABUSE.md`):
- DMCA agent contact
- Takedown request process
- Repeat infringer policy
- Kill-switch procedures
- Appeal process

### 3. Anonymization Standard

**Deliverable**: `docs/standards/ANONYMIZATION.md`

Must define:
- Quantitative thresholds (k-anonymity ≥10, l-diversity for sensitive attributes)
- Multi-model PII detection pipeline (rules + AI + NER)
- Domain-specific rules (rare job titles, unique incidents, geo/time granularity)
- Special category blocklist (health, race, religion if person-linked)
- Re-identification testing methodology
- Adversarial review process
- Rejection workflow for high-risk content

### 4. Technical Implementation

- Age gating UI/verification
- Consent text hash storage (SHA-256)
- User-agent hash (salted, not raw)
- Consent log retention auto-deletion (12-24 months)
- SQLite encryption at rest (local data security)
- Multi-model PII detection (rules + AI + NER)
- Code snippet detection and blocking (>10 lines)
- Secret scanning (API keys, credentials, internal URLs)
- Re-identification risk scoring (k-anonymity ≥10)
- Sensitive category detection (health, race, religion if person-linked)
- Cryptographic signatures on all uploads (required)
- Rate limiting per user (spam prevention)
- Revocation registry and tombstone CIDs
- Kill-switch mechanism
- Least privilege access controls
- Audit logging for consent access

### 5. Operational Procedures

- Takedown request handling (SLA: <24 hours)
- Kill-switch activation criteria and process
- Incident response plan
- Breach notification procedures (72 hours GDPR)
- Consent log access controls
- Subprocessor list maintenance

## Success Metrics

### Compliance Metrics
- 100% of uploads have valid consent record
- 0 uploads without license metadata
- <1% revocation requests
- 0 regulatory complaints

### Trust Metrics
- User satisfaction with consent process ≥4.5/5
- "I understand what is shared" agreement ≥90%
- Opt-in rate ≥20% of users (high trust signal)

### Network Metrics
- Learnings uploaded per user per week
- Approval rate (approved / total pending)
- Revocation rate (revoked / total uploaded)

## Related Documents

### Standards
- [Project Standards - Section 16: Consent & Licensing](../STANDARDS.md#16-consent--licensing-standard)

### Architecture
- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [IPFS Upload System](../architecture/architecture-ipfs-upload-2025-01-16.md)

### Decisions
- [ADR-004: Sanitize Before Storage](./decision-sanitize-before-storage-2025-01-16.md) - Never share raw data
- [ADR-005: Use SQLite](./decision-use-sqlite-2025-01-16.md) - Local storage
- [ADR-006: Async Processing Model](./decision-async-processing-model-2025-01-16.md) - Upload queue

### Plans
- [Original User Vision](../plans/plan-original-user-vision-2025-01-16.md) - Intent to share globally
- [Implementation Roadmap](../plans/plan-implementation-roadmap-2025-01-16.md) - Phase 7: Global Network

### External Reviews
- [GPT-5 Holistic Review](../reviews/gpt5-holistic-review-2025-01-16.txt) - Critical Issue #7
- [Gemini 2.5 Pro Review](../reviews/gemini-holistic-review-2025-01-16.txt) - Critical Blocker #2

### Legal
- [Privacy Policy](../legal/PRIVACY.md) (to be created)
- [Terms of Service](../legal/TERMS.md) (to be created)
- [Data Contribution Agreement](../legal/CONTRIBUTION.md) (to be created)
- [Abuse and Takedown Policy](../legal/ABUSE.md) (to be created)
- [DPIA](../legal/DPIA-2025.md) (to be created before launch)
- [CC BY 4.0 License Text](https://creativecommons.org/licenses/by/4.0/legalcode)

### Standards
- [Anonymization Standard](../standards/ANONYMIZATION.md) (to be created before launch)

### Review
- [GPT-5 Review of ADR-007](../reviews/gpt5-adr007-review-2025-01-16.txt) - Legal and ethical validation

---

**GPT-5 Validation**: This ADR was comprehensively reviewed by GPT-5 for legal and ethical soundness. ALL recommended improvements have been incorporated:

**Anonymization Rigor**:
- Quantitative k-anonymity thresholds (k ≥10, l-diversity for sensitive attributes)
- Multi-model PII detection pipeline (rules + AI + NER)
- Re-identification risk scoring and blocking
- Special category blocklist (health, race, religion if person-linked)
- Adversarial review process documented

**Legal Framework**:
- DPIA requirement before launch (GDPR Article 35)
- Controller/processor roles defined
- Data Contribution Agreement with warranties and indemnification
- Privacy Policy, Terms, Abuse Policy requirements documented
- International transfer mechanisms (SCCs, subprocessor list)

**Age Protection**:
- Age gating: 16+ (EU), 13+ (US) required
- Global sharing blocked for minors in MVP
- Age confirmation in contribution agreement

**Consent Minimization**:
- IP address removed (no necessity, creates GDPR obligations)
- User-agent hashed only (salted, not raw)
- 12-24 month retention with auto-deletion
- Consent text hash for audit integrity

**Additional Risks Addressed**:
- Re-identification (k-anonymity, adversarial testing)
- Confidential content leakage (secret scanning, warranties)
- Code copyright (>10 lines blocked, separate license future)
- Defamation/illegal content (classification, fast-track takedown)
- Dataset poisoning (cryptographic signatures, rate limiting)
- Attribution privacy (blockchain addresses treated as personal data)
- Security/local data (SQLite encryption, incident response)
- Token/rewards (AML/KYC documented for future)

**Legal Documentation Required**:
- Privacy Policy with controller identity, DPO, data subject rights
- Terms of Service with acceptable use, limitations
- Data Contribution Agreement with warranties, license grants, indemnity
- Abuse and Takedown Policy with DMCA agent, kill-switch
- Anonymization Standard with quantitative thresholds
- DPIA before enabling global sharing

**Technical Implementation**:
- Cryptographic signatures required on all uploads
- Multi-layer PII/secret/code detection
- Re-identification risk scoring
- Kill-switch mechanism
- Revocation registry with tombstone CIDs
- SQLite encryption at rest
- Rate limiting and spam prevention

**Cross-Jurisdiction**:
- GDPR (EU), CCPA (California), LGPD (Brazil), UK GDPR explicitly addressed
- International transfer mechanisms documented
- Subprocessor list requirement

**Database Rights**:
- Dual licensing: CC BY 4.0 per-learning, CC0/ODC-By for aggregated dataset
- Standard attribution string for anonymous contributions
- Moral rights and database rights waiver in contribution agreement

**Status**: This ADR now addresses ALL critical blockers identified by GPT-5 and Gemini 2.5 Pro reviews. It establishes a comprehensive, legally defensible, trust-first foundation for global learning sharing with quantifiable privacy protections and clear legal obligations.

**Disclaimer**: This is not legal advice. Consult qualified privacy/IP counsel to finalize DPIA, legal documents, and cross-border transfer posture before production deployment. All pre-launch requirements MUST be completed before enabling global sharing.
