#!/bin/bash

# Ensure model directories exist
mkdir -p /comfyui/models/diffusion_models

ln -sf /runpod-volume /workspace

# If workspace models exist, create symlinks to comfyui models directory
if [ -d "/workspace/models" ]; then
    echo "Linking workspace models to ComfyUI..."
    
    # Link diffusion models (your INT4 FLUX model)
    if [ -d "/workspace/models/diffusion_models" ]; then
        ln -sf /workspace/models/diffusion_models/* /comfyui/models/diffusion_models/ 2>/dev/null || true
    fi
    
    # Link other model types if they exist
    for model_type in unet checkpoints text_encoders vae clip loras controlnet; do
        if [ -d "/workspace/models/$model_type" ]; then
            mkdir -p /comfyui/models/$model_type
            ln -sf /workspace/models/$model_type/* /comfyui/models/$model_type/ 2>/dev/null || true
        fi
    done
    
    echo "Model linking complete"
fi

# Start the handler
exec python -u /handler.py 