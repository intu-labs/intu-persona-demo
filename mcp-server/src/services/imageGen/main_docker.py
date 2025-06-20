#!/usr/bin/env python3
"""
Production ComfyUI main.py for Docker environments
Optimized for cloud GPU instances (AWS, GCP, Azure, RunPod)
"""
import os
import sys
import logging
import subprocess
import glob

# Set environment variables for optimal performance
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['DO_NOT_TRACK'] = '1'
os.environ['PYTHONUNBUFFERED'] = '1'

# Import ComfyUI modules
import comfy.options
comfy.options.enable_args_parsing()

import folder_paths
from comfy.cli_args import args
from app.logger import setup_logger
import utils.extra_config

# Setup logging
setup_logger(log_level=args.verbose, use_stdout=True)

def install_custom_node_requirements():
    """Install requirements for all custom nodes at runtime"""
    custom_nodes_dir = "/home/comfyui/ComfyUI/custom_nodes"
    
    if not os.path.exists(custom_nodes_dir):
        logging.info("No custom_nodes directory found, skipping requirements installation")
        return
    
    # Find all requirements.txt files in custom nodes
    requirements_files = glob.glob(os.path.join(custom_nodes_dir, "**/requirements.txt"), recursive=True)
    
    for req_file in requirements_files:
        try:
            logging.info(f"Installing requirements from {req_file}")
            subprocess.run([
                sys.executable, "-m", "pip", "install", "-r", req_file
            ], check=True, capture_output=True, text=True)
            logging.info(f"Successfully installed requirements from {req_file}")
        except subprocess.CalledProcessError as e:
            logging.warning(f"Failed to install requirements from {req_file}: {e}")
            # Continue with other requirements files
        except Exception as e:
            logging.warning(f"Error processing {req_file}: {e}")

def apply_custom_paths():
    """Configure model paths for Docker environment"""
    # Set up model directories
    models_dir = "/home/comfyui/ComfyUI/models"
    
    # Ensure all model directories exist
    os.makedirs(os.path.join(models_dir, "checkpoints"), exist_ok=True)
    os.makedirs(os.path.join(models_dir, "clip"), exist_ok=True)
    os.makedirs(os.path.join(models_dir, "vae"), exist_ok=True)
    os.makedirs(os.path.join(models_dir, "diffusion_models"), exist_ok=True)
    os.makedirs(os.path.join(models_dir, "loras"), exist_ok=True)
    os.makedirs(os.path.join(models_dir, "text_encoders"), exist_ok=True)
    
    # Set output directory
    output_dir = "/home/comfyui/data/output"
    os.makedirs(output_dir, exist_ok=True)
    folder_paths.set_output_directory(output_dir)
    
    # Set input directory
    input_dir = "/home/comfyui/data/input"
    os.makedirs(input_dir, exist_ok=True)
    folder_paths.set_input_directory(input_dir)

def main():
    """Main entry point for Docker ComfyUI"""
    try:
        apply_custom_paths()
        
        # Install custom node requirements at runtime
        install_custom_node_requirements()
        
        # Import and start ComfyUI
        from main import start_comfyui
        import asyncio
        
        logging.info("Starting ComfyUI in Docker environment...")
        logging.info(f"CUDA Available: {os.environ.get('NVIDIA_VISIBLE_DEVICES', 'Not set')}")
        
        # Start ComfyUI with Docker-optimized settings
        event_loop, prompt_server, start_all_func = start_comfyui()
        
        try:
            event_loop.run_until_complete(start_all_func())
        except KeyboardInterrupt:
            logging.info("Shutting down ComfyUI...")
        except Exception as e:
            logging.error(f"Error running ComfyUI: {e}")
            sys.exit(1)
            
    except Exception as e:
        logging.error(f"Failed to start ComfyUI: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 