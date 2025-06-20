#!/bin/bash

# Link models
mkdir -p /comfyui/models/diffusion_models
if [ -d "/workspace/models" ]; then
    if [ -d "/workspace/models/diffusion_models" ]; then
        ln -sf /workspace/models/diffusion_models/* /comfyui/models/diffusion_models/ 2>/dev/null || true
    fi
    for model_type in unet checkpoints text_encoders vae clip loras controlnet; do
        if [ -d "/workspace/models/$model_type" ]; then
            mkdir -p /comfyui/models/$model_type
            ln -sf /workspace/models/$model_type/* /comfyui/models/$model_type/ 2>/dev/null || true
        fi
    done
fi

# Start ComfyUI server in the background
cd /comfyui
python main.py --listen 0.0.0.0 --port 8188 &
COMFYUI_PID=$!

# Wait for ComfyUI to be ready
for i in {1..60}; do
    if curl -s http://127.0.0.1:8188/ > /dev/null 2>&1; then
        echo "ComfyUI is ready!"
        break
    fi
    echo "Waiting for ComfyUI... ($i/60)"
    sleep 2
done

# Start the handler (foreground)
python -u /handler.py