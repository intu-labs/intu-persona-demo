#!/usr/bin/env python3

import runpod
import json
import os
import sys
import subprocess
import requests
import time
import base64
import logging
from pathlib import Path
import boto3
import uuid
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COMFYUI_PATH = "/home/comfyui/ComfyUI"

# Add ComfyUI to path
sys.path.append(COMFYUI_PATH)

def upload_to_s3(image_data, filename):
    """Upload image to S3-compatible storage"""
    try:
        # Get S3 configuration from environment
        endpoint_url = os.getenv('BUCKET_ENDPOINT_URL')
        access_key = os.getenv('BUCKET_ACCESS_KEY_ID')
        secret_key = os.getenv('BUCKET_SECRET_ACCESS_KEY')
        bucket_name = os.getenv('BUCKET_NAME', 'comfyui-output')
        
        if not all([endpoint_url, access_key, secret_key]):
            logger.warning("S3 credentials not configured, skipping upload")
            return None
            
        # Initialize S3 client
        s3_client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        base_name = os.path.splitext(filename)[0]
        extension = os.path.splitext(filename)[1] or '.png'
        s3_key = f"generated/{timestamp}_{unique_id}_{base_name}{extension}"
        
        # Upload image
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=base64.b64decode(image_data),
            ContentType='image/png' if extension == '.png' else 'image/jpeg'
        )
        
        # Generate public URL
        public_url = f"{endpoint_url.rstrip('/')}/{bucket_name}/{s3_key}"
        logger.info(f"Image uploaded to S3: {public_url}")
        return public_url
        
    except Exception as e:
        logger.error(f"Failed to upload to S3: {e}")
        return None

def setup_models():
    """Setup model directories and symlinks"""
    logger.info("Setting up model directories...")
    
    model_paths = [
        f"{COMFYUI_PATH}/models/diffusion_models",
        f"{COMFYUI_PATH}/models/text_encoders", 
        f"{COMFYUI_PATH}/models/vae",
        f"{COMFYUI_PATH}/models/loras"
    ]
    
    for path in model_paths:
        os.makedirs(path, exist_ok=True)
        logger.info(f"Created directory: {path}")
    
    # Try to link models from various possible locations
    # Serverless volume is usually mounted at /workspace or a custom path set in template
    # Also check local models directory from Docker build
    possible_storage = ["/home/comfyui", "/workspace", "/runpod-volume", "/comfyui-models", "/network-volume"]
    
    for storage in possible_storage:
        model_dir = f"{storage}/models"
        if os.path.exists(model_dir):
            logger.info(f"Found models in {storage}")
            for item in os.listdir(model_dir):
                src_item_path = os.path.join(model_dir, item)
                dst_item_path = os.path.join(f"{COMFYUI_PATH}/models", item)
                if os.path.isdir(src_item_path):
                    dst_model_subdir = os.path.join(f"{COMFYUI_PATH}/models", item)
                    if not os.path.exists(dst_model_subdir):
                         os.makedirs(dst_model_subdir, exist_ok=True)
                    for sub_item in os.listdir(src_item_path):
                        src_sub_item_path = os.path.join(src_item_path, sub_item)
                        dst_sub_item_path = os.path.join(dst_model_subdir, sub_item)
                        if not os.path.exists(dst_sub_item_path):
                            try:
                                os.symlink(src_sub_item_path, dst_sub_item_path)
                                logger.info(f"Linked {src_sub_item_path} -> {dst_sub_item_path}")
                            except Exception as e:
                                logger.warning(f"Failed to link {src_sub_item_path}: {e}")
                elif os.path.isfile(src_item_path):
                    if not os.path.exists(dst_item_path):
                        try:
                            os.symlink(src_item_path, dst_item_path)
                            logger.info(f"Linked {src_item_path} -> {dst_item_path}")
                        except Exception as e:
                            logger.warning(f"Failed to link {src_item_path}: {e}")
            return True
    
    logger.warning("No model storage with a 'models' subdirectory found in possible_storage locations.")
    return False

def wait_for_comfy_server(url, timeout=60):
    """Wait for ComfyUI server to be ready"""
    logger.info(f"Waiting for ComfyUI server at {url}...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{url}/system_stats", timeout=5)
            if response.status_code == 200:
                logger.info("ComfyUI server is ready.")
                return True
        except requests.exceptions.RequestException as e:
            logger.debug(f"ComfyUI server not ready yet ({e}), retrying...")
        time.sleep(2)
    logger.error("ComfyUI server did not start within timeout.")
    return False

def handler(job):
    """Main handler function for RunPod serverless"""
    logger.info("=== RunPod ComfyUI+Nunchaku Handler Starting ===")
    
    comfy_process = None
    
    try:
        # Setup models
        setup_models()
        
        # Get input
        input_data = job.get("input", {})
        workflow = input_data.get("workflow")
        
        if not workflow:
            logger.error("No workflow provided in input.")
            return {"error": "No workflow provided"}
        
        logger.info("Processing workflow...")
        
        # Start ComfyUI server temporarily for serverless request
        logger.info("Starting ComfyUI server...")
        comfy_process = subprocess.Popen([
            "python3", "main.py", 
            "--listen", "127.0.0.1", 
            "--port", "8188"
        ], cwd=COMFYUI_PATH, 
           stdout=subprocess.PIPE, 
           stderr=subprocess.PIPE)
        
        # Wait for server to start
        server_url = "http://127.0.0.1:8188"
        if not wait_for_comfy_server(server_url):
            stdout, stderr = comfy_process.communicate()
            logger.error(f"ComfyUI stdout: {stdout.decode() if stdout else 'N/A'}")
            logger.error(f"ComfyUI stderr: {stderr.decode() if stderr else 'N/A'}")
            return {"error": "Failed to start ComfyUI server"}
        
        # Submit workflow
        logger.info("Submitting workflow to ComfyUI...")
        url = f"{server_url}/prompt"
        payload = {"prompt": workflow}
        
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            prompt_id = result.get("prompt_id")
            logger.info(f"Workflow submitted with ID: {prompt_id}")
            
            # Wait for completion
            max_wait = 300  # 5 minutes
            poll_start_time = time.time()
            
            while time.time() - poll_start_time < max_wait:
                try:
                    history_response = requests.get(f"{server_url}/history/{prompt_id}", timeout=5)
                    if history_response.status_code == 200:
                        history = history_response.json()
                        if prompt_id in history and history[prompt_id].get("outputs"):
                            logger.info("Workflow completed.")
                            break
                        else:
                            logger.debug("Workflow still processing...")
                except requests.exceptions.RequestException as e:
                    logger.warning(f"Error polling history: {e}")
                time.sleep(5)
            else:
                logger.error("Workflow timed out or did not complete with outputs.")
                return {"error": "Workflow timed out or did not complete with outputs."}
            
            # Get output images
            output_dir = f"{COMFYUI_PATH}/output"
            images = []
            logger.info(f"Looking for output images in: {output_dir}")
            
            if os.path.exists(output_dir):
                for file in sorted(os.listdir(output_dir)):
                    if file.endswith((".png", ".jpg", ".jpeg")):
                        file_path = os.path.join(output_dir, file)
                        try:
                            with open(file_path, "rb") as f:
                                img_data = base64.b64encode(f.read()).decode()
                                
                                # Upload to S3 if configured
                                s3_url = upload_to_s3(img_data, file)
                                
                                image_result = {
                                    "filename": file,
                                    "type": "s3_url"
                                }
                                
                                # Add S3 URL if upload succeeded
                                if s3_url:
                                    image_result["url"] = s3_url
                                    logger.info(f"Added image: {file} (uploaded to S3: {s3_url})")
                                else:
                                    logger.warning(f"Failed to upload {file} to S3, skipping")
                                    continue
                                
                                images.append(image_result)
                        except Exception as e:
                            logger.error(f"Failed to read image {file}: {e}")
            else:
                logger.warning(f"Output directory {output_dir} not found.")
            
            logger.info(f"Returning {len(images)} images.")
            return {"images": images, "prompt_id": prompt_id}
        else:
            error_msg = f"ComfyUI request failed with status {response.status_code}: {response.text}"
            logger.error(error_msg)
            return {"error": error_msg}
         
    except Exception as e:
        error_msg = f"Handler error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {"error": error_msg}
    finally:
        if comfy_process:
            logger.info("Terminating ComfyUI server process...")
            try:
                comfy_process.terminate()
                comfy_process.wait(timeout=10)
                logger.info("ComfyUI process terminated.")
            except Exception as e_term:
                logger.warning(f"Error terminating ComfyUI process: {e_term}. Attempting kill...")
                try:
                    comfy_process.kill()
                    logger.info("ComfyUI process killed.")
                except Exception as e_kill:
                    logger.error(f"Error killing ComfyUI process: {e_kill}")

if __name__ == "__main__":
    logger.info("Starting RunPod serverless handler...")
    runpod.serverless.start({"handler": handler}) 