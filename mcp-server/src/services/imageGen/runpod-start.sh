#!/bin/bash

set -e  # Exit on any error
set -x  # Print commands as they execute

echo "=== RunPod ComfyUI Startup ==="
echo "Startup script executing at: $(date)"
echo "Current user: $(whoami)"
echo "Current directory: $(pwd)"
echo "Environment variables:"
env | grep -E "(PATH|CUDA|HF_)" || true

# Create symlinks from RunPod storage to ComfyUI models directory
echo "Setting up model directories..."
mkdir -p /home/comfyui/ComfyUI/models

# Try multiple possible mount locations
POSSIBLE_PATHS=(
    "/comfyui-models"
    "/workspace" 
    "/runpod-volume"
    "/storage"
)

echo "Checking for models in possible locations..."
for path in "${POSSIBLE_PATHS[@]}"; do
    echo "Checking: $path"
    if [ -d "$path/models" ]; then
        echo "✅ Found models in: $path"
        echo "Contents of $path/models:"
        ls -la "$path/models/" || true
        ln -sf $path/models/* /home/comfyui/ComfyUI/models/ 2>/dev/null || true
        echo "Symlinks created successfully"
        break
    elif [ -d "$path" ]; then
        echo "📁 Found storage at: $path (checking contents...)"
        ls -la "$path" | head -5 || true
    else
        echo "❌ Path not found: $path"
    fi
done

echo "Final models directory contents:"
ls -la /home/comfyui/ComfyUI/models/ || true

echo "Checking Python and GPU..."
python3 --version || echo "Python check failed"
nvidia-smi || echo "GPU check failed (this is okay if no GPU)"

echo "🚀 Starting ComfyUI..."
echo "Change to ComfyUI directory..."
cd /home/comfyui/ComfyUI

echo "About to execute ComfyUI main.py..."
exec python3 main.py --listen 0.0.0.0 --port 8188 --dont-print-server