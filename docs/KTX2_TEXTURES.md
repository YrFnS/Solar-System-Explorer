# KTX2/Basis Texture Pilot

This experiment adds GPU-compressed textures to the existing WebGL 2 explorer without removing the stable quality-tiered WebP path.

## Goals

- reduce decoded GPU texture memory and upload bandwidth
- preserve immediate rendering through the current WebP tiers
- test color, alpha, and radial-strip texture cases before converting the full catalogue
- keep KTX2 useful for a later WebGPU experiment
- make all failures observable and recoverable

## Pilot textures

| ID | Source | Role | Codec | Tiers |
| --- | --- | --- | --- | --- |
| `earth` | `/textures/earth.jpg` | sRGB albedo | BasisLZ/ETC1S | 512, 1024, 2048 |
| `moon` | `/textures/moon.jpg` | sRGB albedo | BasisLZ/ETC1S | 512, 1024, 2048 |
| `earth-clouds` | `/textures/earth-clouds.svg` | sRGB alpha | UASTC + Zstd | 512, 1024, 2048 |
| `saturn-ring` | `/textures/saturn_ring.png` | sRGB alpha strip | UASTC + Zstd | 512, 1024, 2048 |

The ring texture is shared by Saturn and Uranus in the current catalogue.

## Runtime flow

```text
Component requests a texture
          │
          ├─ WebP tier loads immediately through useTexture
          │
          └─ KTX2Loader initializes for the active renderer
                    │
                    ├─ detect supported GPU transcode target
                    ├─ load matching 512 / 1K / 2K KTX2 tier
                    ├─ cache by renderer, texture ID, and quality tier
                    └─ replace the material map after success
```

A missing KTX2 file, unsupported compressed format, failed WASM load, network error, or transcode error leaves the WebP texture active. KTX2 is an enhancement, not a single point of failure.

## Comparison controls

The render-engine panel includes **GPU-compressed textures**. Turning it off switches the pilot surfaces to WebP immediately. Turning it on reuses any successfully cached KTX2 texture.

URL overrides are also available:

```text
?textures=ktx2
?textures=webp
```

The runtime publishes diagnostic information to:

```js
window.__SOLAR_TEXTURE_DIAGNOSTICS__
```

It includes the active backend, loaded and failed texture IDs, GPU texture formats, and the latest fallback error.

## Asset generation

The repository pins Khronos KTX Software 4.4.2 in `.github/workflows/generate-ktx2.yml`.

The generation sequence is:

1. read `ktx2-manifest.json`
2. resize the source with Sharp into a temporary PNG
3. encode BasisLZ or UASTC with generated mipmaps
4. validate with `ktx validate --gltf-basisu`
5. commit the `.ktx2` files as ordinary binary Git payloads

Generate locally after installing the matching KTX tools:

```bash
bun run textures:ktx2:encode
bun run textures:ktx2:verify
```

Normal development and production builds do not require the native encoder. They verify committed KTX2 files and copy the Basis JavaScript/WASM transcoder from the installed Three.js package:

```bash
bun run textures:basis:sync
bun run build
```

## Release gates

The PR must pass:

- complete 12-file pilot set
- valid KTX2 signatures
- Khronos validation in the generation workflow
- per-tier KTX2 artifact budgets
- clean lint and strict TypeScript
- production Next.js build
- browser transcode of all four pilot IDs using a real WebGL 2 context
- KTX2-to-WebP-to-KTX2 control switching
- explicit `?textures=webp` fallback session
- existing desktop, mobile, accessibility, screenshot, and context-recovery tests

## Full-catalogue decision

The remaining textures should be converted only after the pilot is visually inspected at close range and its measurements are compared with WebP. The full migration should preserve the same manifest, fallback, diagnostics, and validation architecture.
