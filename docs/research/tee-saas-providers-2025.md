# TEE SaaS Providers for Running LLMs (2025)

**Research Date**: January 18, 2025
**Use Case**: Running small LLM models (GPT-2 level) in Trusted Execution Environments

---

## Executive Summary

Running LLMs in TEE environments is feasible with modern cloud providers. Small models (500M-1.5B parameters) work best due to memory constraints. AWS Nitro Enclaves is the most mature solution for production use, while Intel SGX and Azure offer GPU-accelerated options.

---

## TEE SaaS Platform Comparison

### 1. **AWS Nitro Enclaves** ⭐ RECOMMENDED

**Status**: Production-ready, actively maintained
**Best For**: Production deployments, healthcare/PII data, enterprise use

#### Key Features
- Isolated compute environments on EC2 instances
- Flexible resource allocation (CPU cores + memory)
- No fixed memory limits (unlike Intel SGX)
- Cryptographic attestation built-in
- Strong isolation from AWS admins

#### LLM Support
- ✅ **Proven**: Official AWS blog post demonstrates Bloom 560M model running in enclaves
- ✅ Open-source reference: [aws-samples/aws-nitro-enclaves-llm](https://github.com/aws-samples/aws-nitro-enclaves-llm)
- ✅ PII/PHI data remains encrypted throughout request-response
- ✅ Supports models via llama.cpp

#### Memory Requirements
- Flexible allocation (no hard limit like SGX)
- Example: Bloom 560M runs comfortably
- Can scale up to 1.5B parameter models with quantization

#### Pricing Model
- Pay for EC2 instance + enclave resources
- No separate enclave licensing fees

#### Getting Started
```bash
# Install AWS Nitro CLI
sudo yum install aws-nitro-enclaves-cli

# Build enclave image
nitro-cli build-enclave --docker-uri <image> --output-file llm.eif

# Run enclave
nitro-cli run-enclave --eif-path llm.eif --memory 4096 --cpu-count 2
```

---

### 2. **Azure Confidential Computing**

**Status**: Production-ready with GPU support (2025)
**Best For**: GPU-accelerated inference, Microsoft ecosystem users

#### Key Features
- DC-series VMs with Intel SGX
- **NEW**: Confidential GPUs (extends TEE to GPU memory)
- Open Enclave SDK support
- AMD SEV-SNP and Intel TDX support

#### GPU TEE Innovation (2025)
- GPU memory becomes part of TEE
- Data encrypted when moving between CPU ↔ GPU over PCIe
- Model weights, prompts, outputs remain encrypted
- Enables faster inference vs CPU-only

#### LLM Support
- ✅ Supports larger models with GPU acceleration
- ✅ Multi-platform: Intel SGX, AMD SEV, Intel TDX
- ⚠️ Higher cost due to GPU requirements

#### Memory Constraints
- Intel SGX: Limited memory (~256MB-512MB traditional, newer up to 1TB with TDX)
- GPU TEE: More flexible with High-Bandwidth Memory

#### Getting Started
- Use Azure Confidential Computing VMs (DCsv3-series)
- Deploy with Open Enclave SDK or Gramine

---

### 3. **Google Cloud Confidential Computing**

**Status**: Production-ready
**Best For**: Google Cloud users, AMD SEV focus

#### Key Features
- AMD SEV (Secure Encrypted Virtualization)
- Confidential VMs with full VM encryption
- Confidential GKE for Kubernetes workloads

#### LLM Support
- ✅ VM-level isolation (less granular than enclaves)
- ✅ Good for multi-tenant environments
- ⚠️ Less documentation for LLM-specific use cases

#### Memory Requirements
- Flexible (VM-based, not enclave-based)
- Can run larger models than SGX

---

### 4. **Intel Trust Authority**

**Status**: Attestation service (complements other TEEs)
**Best For**: Zero Trust attestation, multi-cloud verification

#### Key Features
- Free attestation service
- Verifies TEE validity across clouds
- Supports Intel SGX, TDX, and GPU workloads
- Paid support option available

#### Use Case
- Not a compute platform itself
- Verifies that your AWS/Azure/GCP TEE is legitimate
- Critical for compliance and trust

---

### 5. **Emerging Players**

#### **Anjuna Security (Seaglass)**
- Named to Fast Company's 2025 Most Innovative Companies
- Virtualizes modern CPUs for hardware-enforced isolation
- Focus: Enterprise-grade abstraction layer
- Status: Growing but less documentation

#### **Cape Privacy (Cape API)**
- Designed for LLM + confidential knowledge bases
- Privacy-focused API layer
- Status: Limited public information

#### **llm-in-tee Project** (Open Source)
- GitHub: [ai-chen2050/llm-in-tee](https://github.com/ai-chen2050/llm-in-tee)
- Multi-platform support planned (AWS, Azure, SGX, AMD SEV, Nvidia)
- Uses llama.cpp as executor
- Status: Community-driven, experimental

---

## Small LLM Models Suitable for TEE

### Recommended Models

| Model | Parameters | Memory (4-bit) | Memory (FP16) | TEE Compatibility |
|-------|-----------|----------------|---------------|-------------------|
| **Bloom 560M** | 560M | ~350MB | ~1.1GB | ✅ Excellent (AWS proven) |
| **GPT-2 Small** | 124M | ~75MB | ~250MB | ✅ Excellent |
| **GPT-2 Medium** | 355M | ~215MB | ~700MB | ✅ Excellent |
| **GPT-2 Large** | 774M | ~470MB | ~1.5GB | ✅ Good (with quantization) |
| **DeepSeek-R1-1.5B** | 1.5B | ~900MB | ~3GB | ✅ Good (tested in TDX) |
| **Llama 2 7B** | 7B | ~4GB | ~14GB | ⚠️ Limited (Nitro only, needs quantization) |

### Recent Research Findings

**DeepSeek in TEE Study (2025)**:
- Smaller models (1.5B params) perform better in TEE
- Intel TDX outperformed CPU-only for DeepSeek-R1-1.5B
- Sweet spot: 500M-1.5B parameters for TEE environments

### Quantization for TEE

**4-bit quantization** is essential for TEE deployment:
- Reduces memory by ~75%
- Minimal accuracy loss for small models
- Tools: llama.cpp, GGUF format, bitsandbytes

---

## Decision Matrix

### Choose AWS Nitro Enclaves if:
- ✅ You need production-ready solution NOW
- ✅ You have PII/PHI compliance requirements
- ✅ You want flexible memory allocation
- ✅ You prefer CPU-based inference (lower cost)
- ✅ You need models 500M-1.5B parameters

### Choose Azure Confidential GPU if:
- ✅ You need GPU acceleration
- ✅ You can justify higher costs
- ✅ You want faster inference times
- ✅ You're in Microsoft ecosystem

### Choose Google Cloud if:
- ✅ You're already on GCP
- ✅ You prefer VM-level isolation
- ✅ You need Kubernetes integration (Confidential GKE)

---

## Technical Constraints

### Memory Limits by Platform

| Platform | CPU Memory Limit | GPU Memory | Notes |
|----------|-----------------|------------|-------|
| Intel SGX (traditional) | 256MB-512MB | N/A | Major limitation |
| Intel TDX | Up to 1TB | N/A | Newer, more flexible |
| AWS Nitro | Flexible (GB-scale) | N/A | Best for CPU inference |
| Azure Confidential GPU | Depends on VM | Yes (HBM) | Best for GPU inference |
| AMD SEV | Flexible (VM-based) | Depends | VM-level protection |

### Current Limitations (2025)

1. **Scale-out**: TEEs bound to single physical server (improving in 2025)
2. **GPU costs**: Confidential GPU significantly more expensive
3. **Performance overhead**: 10-30% slower than non-TEE
4. **Model size**: Sweet spot is 500M-1.5B params
5. **Documentation**: Limited for newer platforms

---

## Quick Start Recommendations

### For Experimentation
1. **Start with**: AWS Nitro Enclaves
2. **Model**: Bloom 560M (proven reference)
3. **Framework**: llama.cpp
4. **Cost**: ~$50-100/month for basic EC2 + enclave

### For Production
1. **Platform**: AWS Nitro Enclaves
2. **Attestation**: Intel Trust Authority
3. **Model**: Custom fine-tuned 1-1.5B param model
4. **Quantization**: 4-bit via llama.cpp
5. **Monitoring**: CloudWatch + enclave logs

---

## Code Examples

### AWS Nitro Enclave Setup

```bash
# 1. Launch EC2 with enclave support
aws ec2 run-instances \
  --instance-type m5.xlarge \
  --enclave-options Enabled=true \
  --image-id ami-xxxxx

# 2. Build Docker image with your LLM
docker build -t llm-enclave .

# 3. Convert to enclave image
nitro-cli build-enclave \
  --docker-uri llm-enclave:latest \
  --output-file llm.eif

# 4. Run enclave
nitro-cli run-enclave \
  --eif-path llm.eif \
  --memory 4096 \
  --cpu-count 2 \
  --enclave-cid 16
```

### Sample Dockerfile for LLM in Enclave

```dockerfile
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Install dependencies
RUN yum install -y python3 python3-pip

# Install llama.cpp or your preferred runtime
WORKDIR /app
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Copy model (use quantized version)
COPY models/bloom-560m-4bit.gguf /app/model.gguf

# Copy inference server
COPY server.py .

# Run server
CMD ["python3", "server.py"]
```

---

## Next Steps

1. **Try AWS Nitro Enclaves** with Bloom 560M (use official AWS sample)
2. **Benchmark performance** vs non-TEE deployment
3. **Test attestation** with Intel Trust Authority
4. **Evaluate costs** for your use case
5. **Plan scaling strategy** (single-server limitation)

---

## References

- [AWS Blog: LLM Inference with Nitro Enclaves](https://aws.amazon.com/blogs/machine-learning/large-language-model-inference-over-confidential-data-using-aws-nitro-enclaves/)
- [aws-samples/aws-nitro-enclaves-llm](https://github.com/aws-samples/aws-nitro-enclaves-llm)
- [Azure Confidential GPUs (2025)](https://thomasvanlaere.com/posts/2025/03/azure-confidential-computing-confidential-gpus-and-ai/)
- [DeepSeek TEE Performance Study](https://arxiv.org/html/2502.11347v1)
- [ai-chen2050/llm-in-tee](https://github.com/ai-chen2050/llm-in-tee)
