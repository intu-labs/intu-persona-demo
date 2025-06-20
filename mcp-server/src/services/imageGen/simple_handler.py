#!/usr/bin/env python3

import runpod
import json
import os

def handler(event):
    """Minimal test handler"""
    print("=== HANDLER STARTING ===")
    print(f"Event received: {event}")
    
    try:
        print("Handler is running successfully")
        
        # Just return a simple response
        return {
            "message": "Handler is working",
            "event": str(event)
        }
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    print("=== STARTING RUNPOD SERVERLESS ===")
    runpod.serverless.start({"handler": handler}) 