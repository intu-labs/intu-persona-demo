#!/bin/bash

# Test RunPod Docker image locally
IMAGE_NAME=${1:-"intudev/intu-runpod:v2.0.3"}

echo "🐳 Testing Docker image: $IMAGE_NAME"

# Run the container in the background
echo "Starting container..."
CONTAINER_ID=$(docker run -d -p 8000:8000 --name test-runpod $IMAGE_NAME)

if [ $? -ne 0 ]; then
    echo "❌ Failed to start container"
    exit 1
fi

echo "✅ Container started with ID: $CONTAINER_ID"

# Wait a bit for startup
echo "Waiting 10 seconds for startup..."
sleep 10

# Check if container is still running
if ! docker ps -q --filter "id=$CONTAINER_ID" | grep -q .; then
    echo "❌ Container has stopped. Checking logs..."
    docker logs $CONTAINER_ID
    docker rm $CONTAINER_ID
    exit 1
fi

echo "✅ Container is running. Checking logs..."
docker logs $CONTAINER_ID

# Try to make a health check request
echo ""
echo "🔍 Testing health endpoint..."
curl -s http://localhost:8000/health || echo "❌ Health check failed"

# Test the serverless handler with a simple request
echo ""
echo "🔍 Testing serverless endpoint..."
curl -X POST http://localhost:8000/runsync \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "workflow": {
        "test": "simple test"
      }
    }
  }' || echo "❌ Serverless test failed"

echo ""
echo "📋 Final container logs:"
docker logs $CONTAINER_ID

# Cleanup
echo ""
echo "🧹 Stopping and removing container..."
docker stop $CONTAINER_ID
docker rm $CONTAINER_ID

echo "✅ Test complete!" 