# KTX2/Basis Texture Catalogue

Solar System Explorer uses GPU-compressed KTX2/Basis textures for every active authored surface map while retaining quality-tiered WebP as the immediate and permanent fallback.

The stable production renderer remains WebGL 2. The separate WebGPU laboratory reuses the encoded catalogue but keeps its own isolated renderer implementation.

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

## Explicit tier cache keys

Every adaptive material now requests a concrete WebP URL:

```text
/textures/optimized/earth-512.webp
/textures/optimized/earth-1024.webp
/textures/optimized/earth-2048.webp
```

The quality tier is part of React Three Fiber's actual loader-cache key. A session that moves from Ultra to Eco therefore cannot accidentally reuse a previously cached 2K image under the original `/textures/earth.jpg` key.

Legacy third-party aliases are normalized to the same local canonical sources before tier selection. The global Three.js loading policy leaves already-tiered WebP and KTX2 paths unchanged.

## Runtime flow

```text
Material requests an authored texture
          │
          ├─ explicit 512 / 1K / 2K WebP key loads
          │        │
          │        ├─ shared consumers retain one fallback record
          │        └─ final consumer clears the R3F cache entry
          │
          └─ renderer-owned KTX2Loader initializes lazily
                   │
                   ├─ detect supported GPU transcode target
                   ├─ load matching explicit KTX2 tier
                   ├─ share one record across material consumers
                   ├─ switch each consumer only after success
                   ├─ dispose a superseded tier after its final consumer leaves
                   └─ terminate loader workers when the Canvas is rebuilt
```

Shared maps are reference coordinated. The Moon and near-Earth objects share one source, while Saturn and Uranus share one ring source. The WebP GPU allocation is released only when every consumer of that exact tier has confirmed its compressed replacement.

The active fallback remains in the suspense cache so disabling KTX2 can restore it without a network request. When quality changes, the superseded fallback is disposed and removed with `useTexture.clear()` after its final consumer leaves. Only the current tier remains cached.

Compressed records are keyed by renderer and full KTX2 URL. Pending asynchronous transcodes can be retired; if they complete after their consumers have moved on, the resulting texture is disposed immediately instead of entering residency.

## Canvas and renderer teardown

`TextureLifecycleManager` runs inside the production Canvas. It performs two jobs:

1. reset runtime diagnostics when the effective 512/1K/2K tier changes;
2. call `disposeRendererTextureResources()` when React Three Fiber unmounts the renderer.

Renderer teardown:

- retires all pending KTX2 records;
- disposes every loaded compressed texture owned by that renderer;
- clears the renderer record map;
- calls `KTX2Loader.dispose()` to terminate Basis worker resources;
- removes the old renderer from lifecycle diagnostics before a replacement Canvas becomes active.

This applies to normal unmounts and **Rebuild in Eco** after WebGL context interruption.

## Diagnostics

Catalogue status remains available through:

```js
window.__SOLAR_TEXTURE_DIAGNOSTICS__
```

It reports the active quality and tier width, requested/loaded/failed IDs, transcode formats, backend, and latest fallback error. Results from a superseded asynchronous tier are ignored.

Detailed residency and disposal state is available through:

```js
window.__SOLAR_TEXTURE_LIFECYCLE__
```

It reports:

- active quality and tier width;
- retained WebP cache keys;
- WebP keys still GPU resident or released after KTX2 replacement;
- resident and pending KTX2 URLs;
- consumer totals;
- active renderer resource-set count;
- fallback GPU releases and restores;
- fallback disposals and suspense-cache evictions;
- KTX2 disposals;
- KTX2 loader disposals.

## Measured residency gates

A browser gate first loads the complete 13-map catalogue in Eco and records the renderer texture baseline. It then performs:

```text
Eco → Balanced → Ultra → Eco
```

After every transition the gate requires:

- all 13 IDs loaded for the current tier;
- no KTX2 failures;
- no pending transcodes;
- exactly one active renderer resource set;
- exactly one retained WebP tier;
- exactly one resident KTX2 tier;
- no fallback WebP allocation left on the GPU after all compressed replacements are active.

After returning to Eco, `gl.info.memory.textures` must equal the initial Eco baseline. The test also requires meaningful WebP cache-eviction and KTX2-disposal counts.

The same session then simulates context loss and selects **Rebuild in Eco**. The replacement renderer must return to the same texture baseline, contain only 512-tier paths, and increment the KTX2 loader-disposal counter.

The earlier full-catalogue implementation exposed an incorrect 28-texture double-residency state. The coordinated replacement design reduced final residency to 15 textures. The new tier-cycle gate extends that protection beyond initial load and verifies that residency remains bounded after repeated profile changes and renderer reconstruction.

## Comparison controls

The render-engine panel includes **GPU-compressed textures**. It reports current-tier requested/loaded coverage and the active backend:

```text
KTX2   every requested map in the current tier is compressed
MIXED  the current tier is still loading or at least one map uses WebP
WEBP   compressed textures are disabled or unavailable
```

Direct comparison modes are available:

```text
?textures=ktx2
?textures=webp
```

## Asset generation

The repository pins Khronos KTX Software 4.4.2 in `.github/workflows/generate-ktx2.yml`.

The generation sequence is:

1. read `src/components/solar-system/textures/ktx2-manifest.json`;
2. resize each source into a deterministic temporary PNG with Sharp;
3. encode BasisLZ or UASTC and generate mipmaps;
4. validate with `ktx validate --gltf-basisu`;
5. commit the `.ktx2` files as ordinary binary Git payloads.

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

- all 39 signatures and per-tier file counts;
- pinned Khronos validation during generation;
- JavaScript, WebP, and KTX2 artifact budgets;
- clean ESLint and strict TypeScript;
- optimized Next.js production compilation;
- all 13 requested and loaded IDs in a real WebGL 2 browser;
- zero KTX2 failures;
- renderer texture residency at or below the guarded budget;
- KTX2 → WebP → KTX2 switching;
- explicit Eco → Balanced → Ultra → Eco cache-key and residency isolation;
- WebP suspense-cache eviction for superseded tiers;
- KTX2 record disposal for superseded tiers;
- KTX2 loader teardown during renderer reconstruction;
- an explicit `?textures=webp` session;
- desktop, mobile, accessibility, screenshot, orientation, and context-recovery tests.
