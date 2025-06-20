# ComfyUI Image Generation Service - RunPod Serverless Build with Nunchaku
# Based on working local setup, adapted for serverless
FROM nvidia/cuda:12.6.3-devel-ubuntu22.04

# Build argument for HuggingFace token
ARG HF_TOKEN

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies including gcc/g++ for nunchaku compilation
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    git \
    git-lfs \
    wget \
    curl \
    build-essential \
    gcc-11 \
    g++-11 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set gcc/g++ to version 11 (required for nunchaku)
RUN update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-11 100
RUN update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-11 100

# Create comfyui user with proper UID/GID for compatibility
RUN groupadd -r comfyui && useradd -r -g comfyui -u 1000 -m -s /bin/bash comfyui

# Switch to comfyui user and set working directory
USER comfyui
WORKDIR /home/comfyui

# Create Python virtual environment
RUN python3 -m venv venv
ENV PATH="/home/comfyui/venv/bin:$PATH"

# Upgrade pip and install PyTorch with CUDA support (matching CUDA 12.8)
RUN pip install --upgrade pip setuptools wheel
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install RunPod SDK for serverless support
RUN pip install runpod boto3

# Install nunchaku dependencies first
RUN pip install ninja diffusers transformers accelerate sentencepiece protobuf huggingface_hub \
    insightface opencv-python facexlib onnxruntime timm GPUtil

# ===== CRITICAL FIX: Install the CORRECT MIT nunchaku wheel =====
# The PyPI "nunchaku" package is a completely different Nintendo controller library!
# We need the MIT SVDQuant nunchaku from their GitHub releases
RUN pip install https://github.com/mit-han-lab/nunchaku/releases/download/v0.2.0/nunchaku-0.2.0+torch2.5-cp310-cp310-linux_x86_64.whl

# ===== DOWNLOAD SVDQuant MODEL FILES FROM HUGGINGFACE =====
# Install huggingface_hub for downloading models
RUN pip install huggingface_hub

# Authenticate with HuggingFace if token is provided
RUN if [ -n "$HF_TOKEN" ]; then huggingface-cli login --token $HF_TOKEN; fi

# Create directory structure for models
RUN mkdir -p models/diffusion_models models/loras models/text_encoders models/vae workflows

# Download the complete SVDQuant FLUX.1-dev model from HuggingFace
# This downloads the entire model repository 
RUN huggingface-cli download mit-han-lab/svdq-int4-flux.1-dev --local-dir models/diffusion_models/svdq-int4-flux.1-dev

# Download FLUX.1-dev base model components (VAE, text encoders) from public repositories
RUN mkdir -p models/vae && \
    huggingface-cli download black-forest-labs/FLUX.1-dev ae.safetensors --local-dir models/vae && \
    mv models/vae/ae.safetensors models/vae/flux_vae.safetensors

RUN mkdir -p models/text_encoders && \
    huggingface-cli download comfyanonymous/flux_text_encoders clip_l.safetensors --local-dir models/text_encoders && \
    huggingface-cli download comfyanonymous/flux_text_encoders t5xxl_fp8_e4m3fn.safetensors --local-dir models/text_encoders

# Copy workflow template for testing (relative to build context)
COPY --chown=comfyui:comfyui profile-picture-simple.json ./workflows/

# Clone and install ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git
WORKDIR /home/comfyui/ComfyUI

# Install ComfyUI dependencies
RUN pip install -r requirements.txt

# ===== Install ComfyUI-nunchaku from GitHub =====
# Clone the official ComfyUI-nunchaku repository
RUN cd custom_nodes && git clone https://github.com/mit-han-lab/ComfyUI-nunchaku.git

# ===== FIX: Remove PuLID imports (not available in our nunchaku wheel) =====
# Fix the models/__init__.py to remove PuLID imports
RUN printf "from .flux import NunchakuFluxDiTLoader\nfrom .text_encoder import NunchakuTextEncoderLoader\n\n__all__ = [\"NunchakuFluxDiTLoader\", \"NunchakuTextEncoderLoader\"]\n" > custom_nodes/ComfyUI-nunchaku/nodes/models/__init__.py

# Fix the main __init__.py to remove PuLID imports and mappings
RUN printf "# only import if running as a custom node\nfrom .nodes.lora import NunchakuFluxLoraLoader\nfrom .nodes.models import NunchakuFluxDiTLoader, NunchakuTextEncoderLoader\nfrom .nodes.preprocessors import FluxDepthPreprocessor\n\nNODE_CLASS_MAPPINGS = {\n    \"NunchakuFluxDiTLoader\": NunchakuFluxDiTLoader,\n    \"NunchakuTextEncoderLoader\": NunchakuTextEncoderLoader,\n    \"NunchakuFluxLoraLoader\": NunchakuFluxLoraLoader,\n    \"NunchakuDepthPreprocessor\": FluxDepthPreprocessor,\n}\nNODE_DISPLAY_NAME_MAPPINGS = {k: v.TITLE for k, v in NODE_CLASS_MAPPINGS.items()}\n__all__ = [\"NODE_CLASS_MAPPINGS\", \"NODE_DISPLAY_NAME_MAPPINGS\"]\n" > custom_nodes/ComfyUI-nunchaku/__init__.py

# Fix PosixPath issue in flux.py - convert model_path to string before passing to from_pretrained
RUN sed -i 's/model_path,/str(model_path),/' custom_nodes/ComfyUI-nunchaku/nodes/models/flux.py

# Fix unpacking issue properly with a Python script
RUN echo 'import re\nwith open("custom_nodes/ComfyUI-nunchaku/nodes/models/flux.py", "r") as f:\n    content = f.read()\ncontent = re.sub(r"self\\.transformer, self\\.metadata = NunchakuFluxTransformer2dModel\\.from_pretrained\\(", "result = NunchakuFluxTransformer2dModel.from_pretrained(", content)\nlines = content.split("\\n")\nnew_lines = []\ni = 0\nwhile i < len(lines):\n    line = lines[i]\n    new_lines.append(line)\n    if "result = NunchakuFluxTransformer2dModel.from_pretrained(" in line:\n        i += 1\n        paren_count = line.count("(") - line.count(")")\n        while i < len(lines) and paren_count > 0:\n            line = lines[i]\n            new_lines.append(line)\n            paren_count += line.count("(") - line.count(")")\n            i += 1\n        new_lines.extend(["            # Handle unpacking of result", "            if isinstance(result, tuple):", "                self.transformer, self.metadata = result", "            else:", "                self.transformer = result", "                self.metadata = None"])\n        continue\n    i += 1\nwith open("custom_nodes/ComfyUI-nunchaku/nodes/models/flux.py", "w") as f:\n    f.write("\\n".join(new_lines))\nprint("✅ Fixed flux.py unpacking issue")' > /tmp/fix_flux.py && \
    python3 /tmp/fix_flux.py

# Test that the custom nodes can be imported properly
RUN echo 'try:\n    from nodes.models import NunchakuFluxDiTLoader, NunchakuTextEncoderLoader\n    print("✅ Nunchaku models imported successfully")\n    print("NunchakuFluxDiTLoader:", NunchakuFluxDiTLoader)\n    print("NunchakuTextEncoderLoader:", NunchakuTextEncoderLoader)\nexcept Exception as e:\n    print("❌ Failed to import Nunchaku models:", str(e))\n    import traceback\n    traceback.print_exc()' > /tmp/test_imports.py && \
    cd custom_nodes/ComfyUI-nunchaku && python3 /tmp/test_imports.py

# Alternative approach: Use sed to remove only PuLID lines (uncomment if above fails)
# RUN sed -i '/pulid/Id' custom_nodes/ComfyUI-nunchaku/nodes/models/__init__.py
# RUN sed -i '/PuLID/d' custom_nodes/ComfyUI-nunchaku/__init__.py

# Create data directories for volume mounts
RUN mkdir -p /home/comfyui/data/input /home/comfyui/data/output

# Copy the RunPod serverless handler (relative to build context)
COPY --chown=comfyui:comfyui handler.py .

# Copy working workflow for testing with proper input structure
COPY --chown=comfyui:comfyui working_test_input.json ./test_input.json

# Create a debug monitoring script
RUN echo '#!/bin/bash\necho "🔍 Starting ComfyUI execution monitor..."\nwhile true; do\n  echo "=== $(date) ==="\n  curl -s http://127.0.0.1:8188/queue 2>/dev/null | python3 -c "import json,sys; data=json.load(sys.stdin) if sys.stdin.read().strip() else {}; print(f\"Queue: running={len(data.get(\"queue_running\",[]))}, pending={len(data.get(\"queue_pending\",[]))}\")" 2>/dev/null || echo "ComfyUI not ready"\n  curl -s http://127.0.0.1:8188/history 2>/dev/null | python3 -c "import json,sys; data=json.load(sys.stdin) if sys.stdin.read().strip() else {}; [print(f\"Workflow {pid[:8]}: {info.get(\"status\",{}).get(\"status_str\",\"unknown\")}\") for pid,info in list(data.items())[-3:]]" 2>/dev/null || echo "No history"\n  nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 | awk \"{print \"GPU: Memory=\" \\$1 \"/\" \\$2 \"MB, Util=\" \\$3 \"%\"}\"\n  sleep 10\ndone' > /home/comfyui/monitor.sh && chmod +x /home/comfyui/monitor.sh

# Set environment variables for optimal performance
ENV PYTHONUNBUFFERED=1
ENV PYTHONPYCACHEPREFIX=/home/comfyui/.cache/pycache
ENV CUDA_CACHE_PATH=/home/comfyui/.cache/cuda
ENV HF_HOME=/home/comfyui/.cache/huggingface

# Create cache directories
RUN mkdir -p /home/comfyui/.cache/pycache /home/comfyui/.cache/cuda /home/comfyui/.cache/huggingface

# Test nunchaku installation
RUN python3 -c "import nunchaku; print('✅ Nunchaku imported successfully')"

# For serverless, we run the handler instead of ComfyUI server
CMD ["python3", "handler.py"]