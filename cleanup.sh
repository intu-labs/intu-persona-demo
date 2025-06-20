#!/bin/bash

echo "🧹 Cleaning up INTU Persona Demo processes..."

# Kill processes on port 3000 (MCP Server)
echo "🔍 Checking for processes on port 3000..."
MCP_PIDS=$(lsof -ti:3000 2>/dev/null || true)
if [ ! -z "$MCP_PIDS" ]; then
    echo "🔪 Killing processes on port 3000: $MCP_PIDS"
    kill -9 $MCP_PIDS 2>/dev/null || true
else
    echo "✅ No processes found on port 3000"
fi

# Kill processes on port 3005 (Orchestrator)
echo "🔍 Checking for processes on port 3005..."
ORCH_PIDS=$(lsof -ti:3005 2>/dev/null || true)
if [ ! -z "$ORCH_PIDS" ]; then
    echo "🔪 Killing processes on port 3005: $ORCH_PIDS"
    kill -9 $ORCH_PIDS 2>/dev/null || true
else
    echo "✅ No processes found on port 3005"
fi

# Kill processes on port 4173 (UI Preview)
echo "🔍 Checking for processes on port 4173..."
UI_PIDS=$(lsof -ti:4173 2>/dev/null || true)
if [ ! -z "$UI_PIDS" ]; then
    echo "🔪 Killing processes on port 4173: $UI_PIDS"
    kill -9 $UI_PIDS 2>/dev/null || true
else
    echo "✅ No processes found on port 4173"
fi

# Clean up PID files
rm -f .mcp.pid .orchestrator.pid .frontend.pid

echo "🧹 Cleanup complete!" 