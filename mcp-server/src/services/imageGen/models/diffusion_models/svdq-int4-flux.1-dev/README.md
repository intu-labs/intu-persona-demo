---
license: other
license_name: flux-1-dev-non-commercial-license
tags:
- text-to-image
- SVDQuant
- FLUX.1-dev
- INT4
- FLUX.1
- Diffusion
- Quantization
- ICLR2025
language:
- en
base_model:
- black-forest-labs/FLUX.1-dev
base_model_relation: quantized
pipeline_tag: text-to-image
datasets:
- mit-han-lab/svdquant-datasets
library_name: diffusers
---

<p align="center" style="border-radius: 10px">
  <img src="https://github.com/mit-han-lab/nunchaku/raw/refs/heads/main/assets/logo.svg" width="50%" alt="logo"/>
</p>
<h4 style="display: flex; justify-content: center; align-items: center; text-align: center;">Quantization Library:&nbsp;<a href='https://github.com/mit-han-lab/deepcompressor'>DeepCompressor</a> &ensp; Inference Engine:&nbsp;<a href='https://github.com/mit-han-lab/nunchaku'>Nunchaku</a>
</h4>


<div style="display: flex; justify-content: center; align-items: center; text-align: center;">
  <a href="https://arxiv.org/abs/2411.05007">[Paper]</a>&ensp;
  <a href='https://github.com/mit-han-lab/nunchaku'>[Code]</a>&ensp;
  <a href='https://svdquant.mit.edu'>[Demo]</a>&ensp;
  <a href='https://hanlab.mit.edu/projects/svdquant'>[Website]</a>&ensp;
  <a href='https://hanlab.mit.edu/blog/svdquant'>[Blog]</a>
</div>

![teaser](https://github.com/mit-han-lab/nunchaku/raw/refs/heads/main/assets/teaser.jpg)
SVDQuant is a post-training quantization technique for 4-bit weights and activations that well maintains visual fidelity. On 12B FLUX.1-dev, it achieves 3.6× memory reduction compared to the BF16 model. By eliminating CPU offloading, it offers 8.7× speedup over the 16-bit model when on a 16GB laptop 4090 GPU, 3× faster than the NF4 W4A16 baseline. On PixArt-∑, it demonstrates significantly superior visual quality over other W4A4 or even W4A8 baselines. "E2E" means the end-to-end latency including the text encoder and VAE decoder.

## Method
#### Quantization Method -- SVDQuant

![intuition](https://github.com/mit-han-lab/nunchaku/raw/refs/heads/main/assets/intuition.gif)
Overview of SVDQuant. Stage1: Originally, both the activation ***X*** and weights ***W*** contain outliers, making 4-bit quantization challenging.  Stage 2: We migrate the outliers from activations to weights, resulting in the updated activation and weight. While the activation becomes easier to quantize, the weight now becomes more difficult. Stage 3: SVDQuant further decomposes the weight into a low-rank component and a residual with SVD. Thus, the quantization difficulty is alleviated by the low-rank branch, which runs at 16-bit precision. 

#### Nunchaku Engine Design

![engine](https://github.com/mit-han-lab/nunchaku/raw/refs/heads/main/assets/engine.jpg) (a) Naïvely running low-rank branch with rank 32 will introduce 57% latency overhead due to extra read of 16-bit inputs in *Down Projection* and extra write of 16-bit outputs in *Up Projection*. Nunchaku optimizes this overhead with kernel fusion. (b) *Down Projection* and *Quantize* kernels use the same input, while *Up Projection* and *4-Bit Compute* kernels share the same output. To reduce data movement overhead, we fuse the first two and the latter two kernels together.

## Model Description

- **Developed by:** MIT, NVIDIA, CMU, Princeton, UC Berkeley, SJTU and Pika Labs
- **Model type:** INT W4A4 model
- **Model size:** 6.64GB
- **Model resolution:** The number of pixels need to be a multiple of 65,536.
- **License:** Apache-2.0

## Usage

### Diffusers

Please follow the instructions in [mit-han-lab/nunchaku](https://github.com/mit-han-lab/nunchaku) to set up the environment. Then you can run the model with

```python
import torch
from diffusers import FluxPipeline

from nunchaku.models.transformer_flux import NunchakuFluxTransformer2dModel

transformer = NunchakuFluxTransformer2dModel.from_pretrained("mit-han-lab/svdq-int4-flux.1-dev")
pipeline = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev", transformer=transformer, torch_dtype=torch.bfloat16
).to("cuda")
image = pipeline("A cat holding a sign that says hello world", num_inference_steps=50, guidance_scale=3.5).images[0]
image.save("example.png")
```

### Comfy UI

![comfyui](https://github.com/mit-han-lab/nunchaku/blob/main/assets/comfyui.jpg?raw=true)
Please check [comfyui/README.md](comfyui/README.md) for the usage.

## Limitations

- The model is only runnable on NVIDIA GPUs with architectures sm_86 (Ampere: RTX 3090, A6000), sm_89 (Ada: RTX 4090), and sm_80 (A100). See this [issue](https://github.com/mit-han-lab/nunchaku/issues/1) for more details.
- You may observe some slight differences from the BF16 models in details.

### Citation

If you find this model useful or relevant to your research, please cite

```bibtex
@inproceedings{
  li2024svdquant,
  title={SVDQuant: Absorbing Outliers by Low-Rank Components for 4-Bit Diffusion Models},
  author={Li*, Muyang and Lin*, Yujun and Zhang*, Zhekai and Cai, Tianle and Li, Xiuyu and Guo, Junxian and Xie, Enze and Meng, Chenlin and Zhu, Jun-Yan and Han, Song},
  booktitle={The Thirteenth International Conference on Learning Representations},
  year={2025}
}
```