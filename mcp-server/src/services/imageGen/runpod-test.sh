#!/bin/bash

# Create the volume if it doesn't exist
echo "Creating volume..."
docker volume create comfyui-models

# Pull the image
echo "Pulling Docker image..."
docker pull intudev/intu-runpod:test

# Run the container with GPU support
echo "Starting container..."
docker run --gpus all \
    -p 8188:8188 \
    -v comfyui-models:/comfyui-models \
    --name comfyui-test \
    intudev/intu-runpod:test

# To stop the container:
# docker stop comfyui-test
# docker rm comfyui-test

# To inspect the volume:
# docker volume inspect comfyui-models 