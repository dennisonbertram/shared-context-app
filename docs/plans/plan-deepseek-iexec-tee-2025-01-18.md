# Implementation Plan: DeepSeek-R1 on iExec TDX

**Goal**: Deploy DeepSeek-R1-Distill-Qwen-1.5B model on iExec Intel TDX for confidential AI inference

**Status**: Ready for Execution ✅
**Date**: 2025-01-18
**Language**: JavaScript/Node.js
**Reviewed By**: Claude + GPT-5 (2 rounds)
**Confidence**: High

---

## Phase 1: Local iApp Setup & Validation

**Goal**: Get a basic JavaScript iApp working locally and validated

### Tasks
- [ ] Install iApp CLI: `npm -g install iexec`
- [ ] Create project: `mkdir deepseek-iapp && cd deepseek-iapp`
- [ ] Initialize: `iapp init` (choose JavaScript, Hello World)
- [ ] Test locally: `iapp test --args "prompt=Hello"`
- [ ] **Validation**: Verify output in `/iexec_out/result.txt`
- [ ] **Validation**: Confirm `computed.json` is created correctly

**Estimated effort**: 1 hour

**Success Gate**: Don't proceed unless Hello World works perfectly

---

## Phase 2: Add DeepSeek Model + Memory Testing

**Goal**: Integrate DeepSeek-R1-Distill-Qwen-1.5B and validate memory constraints

### Tasks
- [ ] Choose runtime:
  - **Recommended**: transformers.js (simpler, try first)
  - Fallback: llama.cpp bindings (if memory issues)
- [ ] Download quantized model (4-bit, ~1.1GB)
- [ ] Update `src/app.js`:
  ```javascript
  const fsPromises = require('fs').promises;
  // Load model
  // Monitor memory: process.memoryUsage()
  // Get prompt from args
  // Run inference
  // Write result to IEXEC_OUT
  ```
- [ ] **Critical**: Test memory usage locally
  - [ ] Measure peak RAM usage during inference
  - [ ] Must be <6GB (leave 2GB buffer for TDX)
  - [ ] If >6GB, switch to more aggressive quantization
- [ ] Test inference speed (should be >10 tok/s)
- [ ] **Validation**: Multiple test prompts with different lengths

**Estimated effort**: 4-5 hours

**Success Gate**: Memory <6GB AND inference works reliably

---

## Phase 3: Docker + TDX Deployment

**Goal**: Build, test, and deploy to iExec TDX in one streamlined phase

### Tasks

**3a. Docker Build**
- [ ] Create optimized Dockerfile:
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  # Copy package files
  COPY package*.json ./
  RUN npm ci --production
  # Copy model (~1.1GB)
  COPY models/ ./models/
  # Copy app
  COPY src/ ./src/
  ENTRYPOINT ["node", "/app/src/app.js"]
  ```
- [ ] Build: `docker build -t <dockerhub-user>/deepseek-iapp:0.0.1 .`
- [ ] **Validation**: Test Docker locally with same args
- [ ] **Validation**: Verify output matches non-Docker test

**3b. TDX Configuration & Deployment**
- [ ] Enable TDX: `export EXPERIMENTAL_TDX_APP=true`
- [ ] Update `iexec.json` with TDX framework
- [ ] Login to DockerHub
- [ ] Deploy: `EXPERIMENTAL_TDX_APP=true iapp deploy`
- [ ] **Save the app address** (you'll need it!)

**3c. First TDX Test**
- [ ] Run on TDX:
  ```bash
  iapp run <app-address> \
    --tag tee,tdx \
    --workerpool tdx-labs.pools.iexec.eth \
    --args "prompt=Hello from TDX!" \
    --watch
  ```
- [ ] Download and verify results
- [ ] **Security Check**: Verify TEE attestation in logs
- [ ] Test with longer prompt (50+ words)

**Estimated effort**: 3-4 hours

**Success Gate**: Successfully runs in TDX with correct output

---

## Phase 4: Protected Data (Optional - Advanced)

**Goal**: Enable confidential data processing (optional for MVP)

**Note**: This phase can be skipped for initial deployment. Add later if needed.

### Tasks
- [ ] Install DataProtector SDK: `npm install @iexec/dataprotector`
- [ ] Create test protected data
- [ ] Update app.js to read from `IEXEC_IN/${IEXEC_DATASET_FILENAME}`
- [ ] Test with protected data:
  ```javascript
  await dataProtectorCore.processProtectedData({
    protectedData: '0x123abc...',
    app: '<your-app-address>',
    workerpool: 'tdx-labs.pools.iexec.eth'
  });
  ```

**Estimated effort**: 2-3 hours (if implementing)

**Can Skip**: Not required for basic inference to work

---

## Technical Decisions

### Model Runtime
**Decision**: Start with transformers.js
- **Why**: Easier to integrate, pure JavaScript
- **Alternative**: llama.cpp if performance needed
- **Can switch later** if transformers.js too slow

### Docker Strategy
**Decision**: Include model in Docker image
- **Why**: Simpler, no download at runtime
- **Tradeoff**: Larger image (~1.5GB)
- **Alternative**: Download model at startup (slower cold start)

### Memory Allocation
**Decision**: 8GB for TDX enclave
- **Why**: 1.1GB model + 2-3GB inference + 2GB buffer
- **Should be enough** based on research (TDX supports this)

---

## Success Criteria (MVP)

**Must Have**:
- [ ] Deploy DeepSeek-R1 to iExec TDX successfully
- [ ] Inference works (input prompt → AI response)
- [ ] Runs in genuine Intel TDX environment (verify attestation)
- [ ] Memory usage <6GB during inference
- [ ] Inference speed >10 tokens/second

**Nice to Have** (can add later):
- [ ] Can process protected data confidentially
- [ ] Inference speed >20 tokens/second
- [ ] Support for long prompts (500+ tokens)

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Out of memory in TEE | High | Medium | Test memory early (Phase 2), use 6GB target, have fallback quantization |
| Docker image too large (>2GB) | Medium | Low | Use node:alpine, multi-stage build if needed |
| TDX experimental bugs | Medium | Low | Test thoroughly in Phase 3c, have SGX fallback |
| Model loading too slow | Low | Low | Accept cold start for MVP, optimize later |
| transformers.js performance issues | Medium | Medium | Benchmark in Phase 2, switch to llama.cpp if <10 tok/s |
| iApp CLI version incompatibility | Low | Low | Document exact versions used |

---

## Security Checklist

Before considering this production-ready:

- [ ] Verify TEE attestation in logs (proves genuine TDX)
- [ ] Confirm no secrets/keys in Docker image or logs
- [ ] Test that protected data is only accessible inside TEE
- [ ] Validate input sanitization (prevent prompt injection)
- [ ] Review iExec permissions and wallet security

**Note**: For MVP/testing, basic security is fine. Add more for production.

---

## Revisions

### Based on GPT-5 Review (Round 1)

**Changes Made**:
1. Added validation steps to Phase 1
2. Added memory testing and monitoring to Phase 2
3. Consolidated Phases 3-5 into single deployment phase
4. Made protected data optional (Phase 4)
5. Added security checklist
6. Clarified MVP vs nice-to-have success criteria
7. Expanded risk assessment with likelihood and specific mitigations

**Additions**:
- Success gates after each phase
- Memory target lowered to 6GB (from 8GB) for safety buffer
- Security review step before production
- Version documentation requirement

### Based on GPT-5 Review (Round 2 - Final)

**Final Assessment**: Plan is execution-ready ✅

**Strengths Recognized**:
- Comprehensive validation points throughout
- Well-structured with clear success gates
- Security and risk management properly addressed
- Iterative approach with clear contingencies

**Final Recommendations Implemented**:
- Proactive monitoring noted for memory/Docker size
- Version control emphasized
- Iterative testing approach highlighted in Phase 3

**Execution Readiness**: ✅ Ready to execute with controlled risks

---

## Next Steps

1. **Phase 1**: Set up local iApp and verify Hello World
2. **Phase 2**: Add DeepSeek model and test memory thoroughly
3. **Phase 3**: Deploy to TDX and validate
4. **Optional**: Add protected data support (Phase 4)

**Time Estimate**: 8-12 hours for Phases 1-3 (core MVP)

---

**Note**: This is a simple, iterative plan. Each phase has a clear success gate. Don't proceed to next phase until current phase is working perfectly.
