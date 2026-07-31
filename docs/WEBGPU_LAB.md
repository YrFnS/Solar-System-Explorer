# WebGPU / TSL Laboratory

The laboratory at `/lab/webgpu` evaluates Three.js `WebGPURenderer` without changing the production explorer at `/`.

Production remains on the established `WebGLRenderer` / WebGL 2 architecture. The laboratory is an evidence-gathering route, not a production renderer switch.

## Why the route is isolated

Three.js `WebGPURenderer` initializes asynchronously, can fall back to a WebGL 2 backend, and does not support the production scene's existing `ShaderMaterial`, `RawShaderMaterial`, or `onBeforeCompile()` customizations. Those effects must move to Node Materials and TSL incrementally.

A separate route keeps comparisons honest:

- production remains stable;
- each visual system is validated independently;
- missing effects cannot be hidden inside a large renderer rewrite;
- both backends use the same geometry, camera, assets, KTX2 tier, and TSL graphs;
- performance is measured rather than assumed.

## Milestone status

| Milestone | Scope | Status |
| --- | --- | --- |
| W1 | Renderer selection, ephemeris scene, diagnostics, and Node Material foundation | Complete |
| W2 | KTX2 surfaces, atmospheres, Earth clouds, and rings | Complete |
| W3 | Deterministic TSL stars and solar wind | Complete |
| W4 | TSL Sun corona, glow, and flare arcs | Complete |
| W5a | Restrained TSL nebula/background haze | Complete |
| W5b | Black-hole and wormhole presentation without screen-space distortion | Complete |
| W5c | Toggleable backend-neutral TSL threshold bloom | Complete |
| W6 | Fixed-camera, four-configuration real-device evidence recorder | Complete |

## Backend modes

### Auto WebGPU

```text
/lab/webgpu
```

Auto mode performs an explicit adapter and device preflight:

1. `navigator.gpu` unavailable — use WebGL 2.
2. API present but no usable adapter — use WebGL 2 and expose the reason.
3. Usable adapter and device — initialize `WebGPUBackend`.
4. Adapter succeeds but renderer initialization fails — retry safely with WebGL 2.

The UI reports the backend detected after `renderer.init()`. `navigator.gpu` alone is never treated as proof that WebGPU is active.

### Forced WebGL 2

```text
/lab/webgpu?backend=webgl
```

This creates the same `WebGPURenderer` with `forceWebGL: true`. Geometry, KTX2 maps, TSL graphs, camera, animation rate, DPR, object counts, and controls remain identical.

### Direct-render comparison

```text
/lab/webgpu?post=off
```

This keeps the same renderer and scene but bypasses the W5c `RenderPipeline`. The laboratory toggle changes between threshold bloom and direct rendering without remounting the backend.

## W1 — renderer and TSL foundation

W1 established:

- asynchronous React Three Fiber renderer initialization;
- actual backend inspection through `isWebGPUBackend` and `isWebGLBackend`;
- ephemeris-driven Sun and eight planets;
- shared production orbit calculations;
- backend-neutral Node Materials;
- shared camera and controls;
- initialization, FPS, average, P95, longest-frame, sample, draw-call, and triangle diagnostics;
- complete Canvas remounts during backend switching.

## W2 — KTX2 surfaces and atmospheres

The lab uses a fixed 1K parity tier with 11 unique maps:

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

The maps load through `KTX2Loader.detectSupport(WebGPURenderer)`. Procedural TSL colours remain visible while maps load and after any texture failure.

W2 also added TSL planetary surfaces, Fresnel-style atmospheres, Earth clouds, radial ring UV reconstruction, and post-load frame sampling.

## W3 — deterministic TSL particles

W3 adds:

- 1,600 deterministic instanced stars;
- 320 deterministic solar-wind particles.

TSL evaluates star position, colour, size, opacity, and twinkle, plus solar-wind radial travel, spiral drift, colour transition, size, and fade. JavaScript does not rewrite particle positions each frame.

Runtime contract:

```js
window.__SOLAR_WEBGPU_LAB_EFFECTS__
```

## W4 — TSL Sun presentation

W4 adds:

1. an additive BackSide corona with view-dependent rim intensity;
2. a restrained outer glow;
3. five fixed torus flare arcs with TSL colour and opacity sweeps.

JavaScript creates and disposes geometry and materials but does not rewrite Sun vertices each frame.

Runtime contract:

```js
window.__SOLAR_WEBGPU_LAB_SUN__
```

## W5a — restrained TSL nebula haze

W5a adds two deterministic BackSide haze shells:

- `tsl-nebula-inner`;
- `tsl-nebula-outer`.

They use low-opacity additive Node Materials, fixed transforms and phases, position-derived wave fields, slow material-time animation, no CPU vertex updates, and no post-processing.

Runtime contract, published only while mounted:

```js
window.__SOLAR_WEBGPU_LAB_NEBULA__
```

## W5b — TSL gravitational presentation

W5b adds one deterministic black hole and one deterministic wormhole.

The black hole includes an event-horizon core, TSL halo, two accretion discs, and one photon ring. The wormhole includes two TSL mouth surfaces, one open throat, and animated rim layers.

The presentation deliberately avoids physical ray-traced lensing, screen-space distortion, and post-processing.

Runtime contract, published only while mounted:

```js
window.__SOLAR_WEBGPU_LAB_GRAVITY__
```

It records six exact system IDs, two objects, one black hole, two accretion discs, one wormhole, two mouths, material-TSL animation, no CPU vertex updates, and no screen-space distortion.

## W5c — toggleable TSL render pipeline

W5c adds one deliberately small backend-neutral post-processing experiment:

- one TSL scene pass;
- one threshold bloom pass;
- one Three.js `RenderPipeline`;
- strength `0.18`;
- radius `0.16`;
- threshold `0.78`;
- smooth width `0.08`.

The in-panel checkbox switches between:

```text
render-pipeline-tsl
```

and:

```text
direct-render
```

without remounting the renderer. No CPU pixel rewriting or screen-space lensing/distortion is used.

Runtime contract:

```js
window.__SOLAR_WEBGPU_LAB_POST__
```

## W6 — real-device benchmark protocol

W6 turns the completed parity scene into a repeatable evidence recorder.

The benchmark panel provides:

- one shared camera position at `[0, 34, 62]`;
- one shared target at `[0, 0, 0]`;
- a fresh rolling window after camera preparation, bloom changes, or renderer changes;
- a minimum of 90 fresh frames before a record can be saved;
- automatic invalidation when the user starts moving the camera;
- session storage for up to 16 records;
- JSON download and clipboard export;
- a visible coverage matrix for all four required configurations.

The required physical-device matrix is:

```text
WebGPU + bloom
WebGPU + direct rendering
WebGL 2 + bloom
WebGL 2 + direct rendering
```

A record includes:

- requested and actual backend;
- renderer backend class and adapter status;
- fallback reason when applicable;
- initialization time;
- average, P95, longest-frame, FPS, sample count, draw calls, and triangles;
- KTX2 backend and transcode formats;
- viewport, DPR, screen, user agent, CPU concurrency, and approximate device memory when exposed;
- exact scene counts and post-processing parameters;
- fixed camera and simulation settings.

Runtime contract:

```js
window.__SOLAR_WEBGPU_LAB_BENCHMARK__
```

The browser gate also verifies that manual camera movement invalidates a prepared baseline, bloom and direct samples use separate fresh frame windows, two WebGL records survive a reload through session storage, and clearing removes the session.

## Runtime diagnostics

The laboratory publishes eight diagnostic surfaces:

```js
window.__SOLAR_WEBGPU_LAB__
window.__SOLAR_WEBGPU_LAB_TEXTURES__
window.__SOLAR_WEBGPU_LAB_EFFECTS__
window.__SOLAR_WEBGPU_LAB_SUN__
window.__SOLAR_WEBGPU_LAB_NEBULA__
window.__SOLAR_WEBGPU_LAB_GRAVITY__
window.__SOLAR_WEBGPU_LAB_POST__
window.__SOLAR_WEBGPU_LAB_BENCHMARK__
```

Together they expose backend selection, adapter status, fallback reasons, initialization, rolling frame metrics, KTX2 state, migrated visual systems, object counts, post-processing mode, zero-CPU-update contracts, benchmark readiness, coverage, and exported records.

## Strict browser gate

The production-standalone gates verify:

- forced WebGL 2 initialization and interaction;
- capability-aware Auto selection;
- Auto → forced WebGL 2 → Auto remounts;
- all 11 laboratory KTX2 maps loaded with zero failures;
- compressed transcode-format reporting;
- exact W3 particle IDs and counts;
- exact W4 Sun IDs and five flare arcs;
- exact W5a nebula IDs and two shells;
- exact W5b gravitational IDs and object counts;
- exact W5c pipeline IDs and pass counts;
- bloom → direct render → bloom switching without a renderer remount;
- material/vertex TSL animation contracts;
- no CPU position, vertex, or pixel rewriting;
- no screen-space distortion;
- visible W5c and W6 controls;
- fixed-camera preparation and camera-interaction invalidation;
- separate 90-frame bloom and direct benchmark windows;
- session-persistent benchmark records and four-configuration coverage metadata;
- no uncaught browser errors or invalid canvas layout.

The repository gate also retains module/dependency audit, clean ESLint, strict TypeScript, ephemeris validation, all 39 production KTX2 files, optimized Next.js build, artifact budgets, and production desktop/mobile/accessibility/recovery tests.

Local validation commands:

```bash
bun run webgpu:smoke
bun run webgpu:benchmark:smoke
```

## Hosted-runner WebGPU limitation

GitHub-hosted Chromium exposes `navigator.gpu` but returns no usable core or compatibility Dawn adapter in this workflow. The mandatory hosted gate therefore proves correct detection, safe fallback, complete TSL/KTX2 parity on the WebGL 2 backend, stable remounts, and the full benchmark protocol.

A physical device or self-hosted runner can require a genuine WebGPU result with:

```bash
WEBGPU_REQUIRE_REAL=1 bun run webgpu:smoke
```

When that flag is set, fallback fails the test.

## Promotion boundary

Production must remain on WebGL 2 until the lab demonstrates:

1. visual parity for every migrated system;
2. no silent fallback during claimed WebGPU tests;
3. acceptable initialization and shader-compilation behaviour;
4. stable camera, KTX2, screenshots, and recovery;
5. measurable benefit on target physical devices;
6. reliable WebGL 2 fallback;
7. no significant regression on integrated graphics or mobile hardware.

## Current conclusion

W1 through W6 are complete as an isolated laboratory. The next work is running and exporting the four records on each target device:

```text
Desktop discrete GPU
Desktop integrated GPU
Android phone
Apple device where WebGPU is available
```

For each device, prepare the baseline before the first capture, record bloom and direct modes, switch backend, prepare the baseline again, and record the other two modes. Compare initialization, average frame time, P95 frame time, longest frame, stability, and visual parity—not CI software-renderer FPS.

Production should not change until those measurements justify an opt-in renderer setting.

## Official references

- Three.js WebGPURenderer manual: https://threejs.org/manual/en/webgpurenderer
- Three.js WebGPURenderer API: https://threejs.org/docs/pages/WebGPURenderer.html
- Three.js TSL specification: https://threejs.org/docs/TSL.html
- React Three Fiber Canvas WebGPU example: https://r3f.docs.pmnd.rs/api/canvas
