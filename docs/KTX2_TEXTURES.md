# KTX2/Basis Texture Catalogue

Solar System Explorer uses GPU-compressed KTX2/Basis textures for every active authored surface map while retaining the quality-tiered WebP pipeline as an immediate, permanent fallback.

The stable renderer remains WebGL 2. This texture architecture is also reusable by the separate WebGPU laboratory.

## Active catalogue

The manifest contains 13 unique runtime textures, each encoded at 512, 1024, and 2048 pixel tiers for a total of 39 committed KTX2 binaries.

| ID | Runtime use | Codec |
| --- | --- | --- |
| `sun` | Solar surface | BasisLZ / ETC1S |
| `mercury` | Mercury surface | BasisLZ / ETC1S |
| `venus` | Venus surface | BasisLZ / ETC1S |
| `earth` | Earth surface and local Earth-compatible aliases | BasisLZ / ETC1S |
| `moon` | Moon, shared moon aliases, and near-Earth rocky bodies | BasisLZ / ETC1S |
| `mars` | Mars surface | BasisLZ / ETC1S |
| `jupiter` | Jupiter surface | BasisLZ / ETC1S |
| `saturn` | Saturn surface | BasisLZ / ETC1S |
| `uranus` | Uranus surface | BasisLZ / ETC1S |
| `neptune` | Neptune surface | BasisLZ / ETC1S |
| `pluto` | Pluto surface | BasisLZ / ETC1S |
| `earth-clouds` | Earth cloud alpha layer | UASTC + Zstandard |
| `saturn-ring` | Shared Saturn/Uranus radial alpha strip | UASTC + Zstandard |

Procedural colours, generated particles, shader-only effects, and inactive source images do not need KTX2 payloads. New authored maps should be added to `ktx2-manifest.json` before becoming active runtime dependencies.

## Validated asset measurements

Khronos KTX Software 4.4.2 generated mipmaps and validated every output using `ktx validate --gltf-basisu`.

| Tier | Files | Total KTX2 payload |
| --- | ---: | ---: |
| 512 | 13 | 349.2 kB |
| 1024 | 13 | 1.03 MB |
| 2048 | 13 | 3.32 MB |

For comparison, all generated WebP fallbacks total 234.3 kB, 1.07 MB, and 4.74 MB for the same three quality levels. KTX2 is not always the smallest network payload—especially at 512 px—but it avoids expanding every selected map into an ordinary uncompressed GPU texture.

The project-authored cloud source is 1024 × 512, so its Ultra entry intentionally preserves source resolution rather than enlarging it. Narrow ring strips are edge-padded to portable 4 × 4 block boundaries without introducing transparent seams.

## Runtime flow

```text
Material requests an authored texture
          │
          ├─ matching WebP tier renders immediately
          │
          └─ shared KTX2Loader initializes for the active renderer
                    │
                    ├─ detect supported GPU transcode target
                    ├─ load matching 512 / 1K / 2K KTX2 payload
                    ├─ cache by renderer, texture ID, and tier
                    ├─ switch every material consumer after success
                    └─ release the shared WebP GPU allocation
```

Shared fallback maps are reference-coordinated. For example, the Moon and near-Earth objects share one source, while Saturn and Uranus share one ring source. WebP is released only when every consumer of that source has confirmed its KTX2 replacement.

`Texture.dispose()` frees the WebP GPU allocation but keeps the decoded browser image cached. Disabling KTX2 therefore restores WebP without another network request. A missing KTX2 file, unsupported format, failed WASM load, network error, or transcode error leaves WebP active.

## Measured residency result

A real WebGL 2 browser test first exposed an incorrect implementation that retained 28 textures after loading the full catalogue. The coordinated source-disposal design reduced final texture residency to 15—the same count as the pre-KTX2 baseline—while all 13 compressed maps remained active.

This regression is now protected by the renderer budget in `scripts/smoke-ui.mjs`.

## Comparison controls

The render-engine panel includes **GPU-compressed textures**. It reports requested/loaded catalogue coverage and the active backend:

```text
KTX2   all requested maps compressed
MIXED  at least one map remains on WebP
WEBP   compressed textures disabled or unavailable
```

Direct comparison modes are available:

```text
?textures=ktx2
?textures=webp
```

Runtime diagnostics are published to:

```js
window.__SOLAR_TEXTURE_DIAGNOSTICS__
```

Diagnostics include requested, loaded, and failed IDs; transcode formats; backend; and the latest fallback error.

## Asset generation

The repository pins Khronos KTX Software 4.4.2 in `.github/workflows/generate-ktx2.yml`.

The generation sequence is:

1. read `src/components/solar-system/textures/ktx2-manifest.json`
2. resize each source into a deterministic temporary PNG with Sharp
3. encode BasisLZ or UASTC and generate mipmaps
4. validate with `ktx validate --gltf-basisu`
5. commit the `.ktx2` files as ordinary binary Git payloads

Generate locally after installing the matching KTX tools:

```bash
bun run textures:ktx2:encode
bun run textures:ktx2:verify
```

Normal development and deployment do not require the native encoder. They verify the committed assets and copy the matching Three.js Basis JavaScript/WASM transcoder:

```bash
bun run textures:basis:sync
bun run build
```

## Release gates

The catalogue is required to pass:

- all 39 signatures and per-tier file counts
- pinned Khronos validation during generation
- JavaScript, WebP, and KTX2 artifact budgets
- clean ESLint and strict TypeScript
- optimized Next.js production compilation
- all 13 requested and loaded IDs in a real WebGL 2 browser
- zero KTX2 failures
- renderer texture residency at or below the guarded budget
- KTX2 → WebP → KTX2 switching
- an explicit `?textures=webp` session
- desktop, mobile, accessibility, screenshot, orientation, and context-recovery tests

## Current validation snapshot

The final automated run loaded all 13 IDs with no failures, selected `RGB_ETC2` and `RGBA_ASTC_4x4` transcode formats, and reported 15 resident textures. Draw calls, geometry, shader-program counts, mobile layout, screenshots, and renderer recovery remained within the existing production budgets.
