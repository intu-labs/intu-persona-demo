# handler.py
import runpod
import sys
sys.path.append("/comfyui")  # Ensure ComfyUI is in Python path

from rp_handler import handler as comfy_handler  # Import base handler
from runpod.serverless.modules.rp_logger import RunPodLogger
from ComfyUI_nunchaku import NunchakuFluxDiTLoader
nunchaku_loader = NunchakuFluxDiTLoader()
logger = RunPodLogger()

def handler(job):
    try:
        # Add Nunchaku-specific preprocessing here
        job_input = job["input"]
        
        # Delegate to base handler
        result = comfy_handler(job)
        
        # Add Nunchaku-specific postprocessing here
        return result
    except Exception as e:
        logger.error(f"Nunchaku handler error: {str(e)}")
        return {"error": f"Nunchaku processing failed: {str(e)}"}

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
