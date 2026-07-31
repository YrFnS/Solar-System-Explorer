# WebGPU / TSL Laboratory

The laboratory at `/lab/webgpu` evaluates Three.js `WebGPURenderer` without changing the production explorer at `/`.

Production remains on the established `WebGLRenderer` / WebGL 2 architecture. The lab is an evidence-gathering route, not a production renderer switch.

## Why the route is isolated

Three.js `WebGPURenderer` initializes asynchronously, can fall back to a WebGL 2 backend, and does not support the production scene's existing `ShaderMaterial`, `RawShaderMaterial`, or `onBeforeCompile()` customizations. Those effects must be migrated to Node Materials and TSL incrementally.

A separate route keeps the comparison honest:

- the production application remains stable;
- each visual system can be checked independently;
- missing effects cannot be hidden inside a large renderer rewrite;
- WebGL and WebGPU can use the same geometry, assets, camera, KTX2 tier, and TSL graphs;
- performance is measured instead of assumed.

## Milestone status

| Milestone | Scope | Status |
| --- | --- | --- |
| W1 | Renderer selection, ephemeris scene, diagnostics, and Node Material foundation | Complete |
| W2 | KTX2 surfaces, atmospheres, Earth clouds, and rings | Complete |
| W3 | Deterministic TSL stars and solar wind | Complete |
| W4 | TSL Sun corona, glow, and flare arcs | Complete |
| W5a | Restrained TSL nebula/background haze | Complete |
| W5b | Black-hole and wormhole presentation without post-processing | Complete |
| W5c | Backend-neutral post-processing experiments | Deferred |

## Backend modes

### Auto WebGPU

```text
/lab/webgpu
```

Auto mode performs an explicit adapter and device preflight. It distinguishes:

1. `navigator.gpu` is unavailable — use the WebGL 2 backend.
2. the WebGPU API exists but no usable adapter is returned — use WebGL 2 and display the reason.
3. a usable adapter and device are available — initialize `WebGPUBackend`.
4. adapter preflight succeeds but renderer initialization fails — retry safely with WebGL 2 and expose the failure reason.

The UI reports the backend detected after `renderer.init()`. The presence of `navigator.gpu` alone is never treated as proof that WebGPU is active.

### Forced WebGL 2

```text
/lab/webgpu?backend=webgl
```

This creates the same `WebGPURenderer` with `forceWebGL: true`. The scene keeps the same geometry, KTX2 maps, TSL graphs, camera, animation rate, DPR bounds, object counts, and controls.

## W1 — renderer and TSL foundation

W1 established:

- asynchronous React Three Fiber renderer initialization;
- actual backend inspection through `isWebGPUBackend` and `isWebGLBackend`;
- ephemeris-driven Sun and eight planets;
- shared production orbit calculations;
- backend-neutral Node Materials;
- one shared camera and controls configuration;
- initialization, FPS, average-frame, P95-frame, longest-frame, sample-count, draw-call, and triangle diagnostics;
- complete Canvas remounts when switching backends.

## W2 — KTX2 surfaces and atmospheres

The laboratory uses a fixed 1K parity tier so backend comparisons do not accidentally measure different texture resolutions.

The active set contains 11 unique maps:

- Sun;
- Mercury;
- Venus;
- Earth;
- Earth clouds;
- Mars;
- Jupiter;
- Saturn;
- shared Saturn/Uranus ring map;
- Uranus;
- Neptune.

The maps load through `KTX2Loader.detectSupport(WebGPURenderer)`. Procedural TSL colours remain visible during loading and after any texture failure.

W2 also added TSL planetary surfaces, Fresnel-style atmospheres, the Earth cloud layer, radial ring UV reconstruction, and post-load frame sampling after the full KTX2 set is ready.

## W3 — deterministic TSL particles

W3 adds two deterministic instanced Node Material systems:

- 1,600 stars;
- 320 solar-wind particles.

TSL evaluates star position, colour, size, opacity, and twinkle, plus solar-wind radial travel, spiral drift, colour transition, size, and fade. JavaScript does not rewrite particle positions every frame.

The runtime contract is published as:

```js
window.__SOLAR_WEBGPU_LAB_EFFECTS__
```

## W4 — TSL Sun presentation

W4 adds:

1. an additive BackSide corona using view-dependent rim intensity and animated latitude variation;
2. a restrained outer glow;
3. five fixed torus flare arcs with TSL colour and opacity sweeps.

JavaScript creates and disposes the geometry and materials but does not rewrite Sun vertices every frame.

The runtime contract is published as:

```js
window.__SOLAR_WEBGPU_LAB_SUN__
```

It records the three exact Sun-system IDs, five flare arcs, `material-tsl` animation, and `cpuVertexUpdates: false`.

## W5a — restrained TSL nebula haze

W5a adds two deterministic BackSide haze shells:

- `tsl-nebula-inner`;
- `tsl-nebula-outer`.

The shells use low-opacity additive Node Materials, fixed transforms and phases, position-derived wave fields, slow TSL material-time animation, no CPU vertex updates, and no post-processing.

The component publishes its runtime contract only while mounted:

```js
window.__SOLAR_WEBGPU_LAB_NEBULA__
```

This proves that the scene object mounted; importing the module alone cannot satisfy the browser gate.

## W5b — TSL gravitational presentation

W5b adds one deterministic black hole and one deterministic wormhole while preserving the complete W1–W5a workload.

### Black hole

The laboratory black hole contains:

- an opaque event-horizon core;
- a view-dependent TSL shadow halo;
- two additive accretion discs with independent TSL flow fields;
- one animated photon ring.

### Wormhole

The laboratory wormhole contains:

- two TSL mouth surfaces;
- one open throat mesh;
- animated rim layers around both mouths.

The presentation is intentionally restrained. It does not claim physical ray-traced lensing, does not modify the screen-space image, and does not use post-processing.

The mounted runtime contract is published as:

```js
window.__SOLAR_WEBGPU_LAB_GRAVITY__
```

It records:

- six exact gravitational-system IDs;
- `objectCount: 2`;
- one black hole;
- two accretion discs;
- one wormhole;
- two wormhole mouths;
- `animationMode: 'material-tsl'`;
- `cpuVertexUpdates: false`;
- `postProcessing: false`;
- `screenSpaceDistortion: false`.

## Runtime diagnostics

The laboratory publishes six diagnostic objects:

```js
window.__SOLAR_WEBGPU_LAB__
window.__SOLAR_WEBGPU_LAB_TEXTURES__
window.__SOLAR_WEBGPU_LAB_EFFECTS__
window.__SOLAR_WEBGPU_LAB_SUN__
window.__SOLAR_WEBGPU_LAB_NEBULA__
window.__SOLAR_WEBGPU_LAB_GRAVITY__
```

Together they expose backend selection, adapter status, fallback reasons, renderer initialization, rolling frame metrics, KTX2 state, active particle systems, Sun effects, nebula shells, gravitational objects, and the no-CPU-update/no-post-processing contracts.

## Strict browser gate

The production standalone build is tested rather than a development server. The W5b gate verifies:

- forced WebGL 2 initialization and interaction;
- capability-aware Auto selection;
- Auto → forced WebGL 2 → Auto renderer remounts;
- all 11 expected laboratory KTX2 maps loaded with zero failures;
- compressed transcode format reporting;
- exact W3 particle IDs and counts;
- exact W4 Sun IDs and five flare arcs;
- exact W5a nebula IDs and two shells;
- exact W5b gravity IDs, object counts, disc count, and mouth count;
- material-TSL animation with no CPU position or vertex rewrites;
- no W5a/W5b post-processing;
- no W5b screen-space distortion;
- the visible W5b status surface;
- at least 30 post-KTX2 frame samples;
- no uncaught browser errors or invalid canvas layout.

The complete repository gate also retains the module/dependency audit, clean ESLint, strict TypeScript, ephemeris validation, all 39 production KTX2 files, optimized Next.js build, artifact budgets, and production desktop/mobile/accessibility/recovery tests.

## Latest hosted validation

The final W5b Quality run passed.

Production stayed at its established smoke-test baseline:

```text
Draw calls:      333
Triangles:       90,688
Textures:        15
Programs:        30
Scene objects:   569
```

Artifact measurements remained within budget:

```text
JavaScript chunks:       39
Largest chunk:           651.3 kB
Total static JavaScript: 2.97 MB
```

The hosted software renderer loaded all 11 laboratory KTX2 maps with zero failures and reported `RGB_ETC2` and `RGBA_ASTC_4x4`. W5b samples used 66 draw calls in forced WebGL 2, 74 after Auto fallback, and 68 after the Auto remount.

These frame rates and frame times are software-renderer validation data, not physical-device performance claims.

## Hosted-runner WebGPU limitation

GitHub-hosted Chromium currently exposes `navigator.gpu` but returns no usable core or compatibility Dawn adapter in this workflow. The mandatory hosted gate therefore proves correct detection, safe fallback, complete TSL/KTX2 parity on the WebGL 2 backend, and stable remounts.

A physical device or self-hosted runner can require a genuine WebGPU result with:

```bash
WEBGPU_REQUIRE_REAL=1 bun run webgpu:smoke
```

When that flag is set, fallback fails the test instead of being accepted.

## Comparison rules

A valid backend comparison keeps constant:

- Three.js and React Three Fiber versions;
- viewport and DPR;
- camera position;
- date and animation rate;
- object count and geometry detail;
- TSL material graph;
- lighting;
- KTX2 tier and transcode workload;
- browser and device.

Real-device decisions should use average frame time, P95 frame time, initialization cost, visual parity, and stability on the same hardware.

## Promotion boundary

Production must remain on WebGL 2 until the laboratory demonstrates:

1. visual parity for every migrated system;
2. no silent WebGL fallback during claimed WebGPU tests;
3. acceptable initialization and shader-compilation behaviour;
4. stable camera, selection, KTX2, screenshots, and recovery;
5. a measurable improvement or another concrete operational benefit on target devices;
6. reliable WebGL 2 fallback;
7. no significant regression on integrated graphics or mobile hardware.

## Next migration order

```text
W5a  restrained TSL nebula/background haze        complete
W5b  black-hole and wormhole presentation         complete
W5c  backend-neutral post-processing experiments  deferred
```

W5c should begin with one optional, low-cost backend-neutral pass and must be switchable off. It should not attempt a large bloom, lensing, and distortion stack in one change. Production remains unchanged until physical-device comparisons justify a renderer option.

## Official references

- Three.js WebGPURenderer manual: https://threejs.org/manual/en/webgpurenderer
- Three.js WebGPURenderer API: https://threejs.org/docs/pages/WebGPURenderer.html
- Three.js TSL specification: https://threejs.org/docs/TSL.html
- React Three Fiber Canvas WebGPU example: https://r3f.docs.pmnd.rs/api/canvas
