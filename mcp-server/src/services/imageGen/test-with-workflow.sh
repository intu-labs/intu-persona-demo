#!/bin/bash

# Test RunPod Docker image with actual workflow locally
IMAGE_NAME=${1:-"intudev/intu-runpod:v2.0.3"}
WORKFLOW_FILE=${2:-"test-nunchaku-workflow.json"}

echo "🐳 Testing Docker image: $IMAGE_NAME"
echo "📄 Using workflow file: $WORKFLOW_FILE"

# Check if workflow file exists
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Workflow file $WORKFLOW_FILE not found!"
    exit 1
fi

# Run the container in the background with volume mounting for models (if needed)
echo "Starting container..."
CONTAINER_ID=$(docker run -d -p 8000:8000 --name test-runpod-workflow $IMAGE_NAME)

if [ $? -ne 0 ]; then
    echo "❌ Failed to start container"
    exit 1
fi

echo "✅ Container started with ID: $CONTAINER_ID"

# Function to check logs
check_logs() {
    echo "📋 Current container logs:"
    docker logs $CONTAINER_ID
    echo "---"
}

# Wait for startup and check logs
echo "Waiting 15 seconds for startup..."
sleep 15

check_logs

# Check if container is still running
if ! docker ps -q --filter "id=$CONTAINER_ID" | grep -q .; then
    echo "❌ Container has stopped during startup"
    check_logs
    docker rm $CONTAINER_ID
    exit 1
fi

# Try health check
echo "🔍 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8000/health)
echo "Health response: $HEALTH_RESPONSE"

# Test with the actual workflow
echo ""
echo "🎨 Testing with ComfyUI workflow..."
echo "Sending workflow from $WORKFLOW_FILE..."

# Send the workflow and capture response
RESPONSE=$(curl -X POST http://localhost:8000/runsync \
  -H "Content-Type: application/json" \
  -d @"$WORKFLOW_FILE" \
  -w "\nHTTP_STATUS:%{http_code}" \
  2>/dev/null)

# Parse response and status
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"

# Check logs again
echo ""
echo "📋 Logs after workflow execution:"
check_logs

# Interactive option to keep container running
echo ""
read -p "🤔 Keep container running for manual testing? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🖥️  Container is running at http://localhost:8000"
    echo "🔍 You can test manually with:"
    echo "   curl -X POST http://localhost:8000/runsync -H 'Content-Type: application/json' -d @$WORKFLOW_FILE"
    echo "📋 To see logs: docker logs -f $CONTAINER_ID"
    echo "🛑 To stop: docker stop $CONTAINER_ID && docker rm $CONTAINER_ID"
else
    # Cleanup
    echo "🧹 Stopping and removing container..."
    docker stop $CONTAINER_ID
    docker rm $CONTAINER_ID
    echo "✅ Test complete!"
fi 