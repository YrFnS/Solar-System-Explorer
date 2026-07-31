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
| W7 | Multi-device evidence analysis and conservative renderer recommendation | Complete |

## Routes and backend modes

### Automatic WebGPU selection

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

### Evidence analysis

```text
/lab/webgpu/results
```

This route loads the current browser session or imports one or more benchmark JSON exports. It never compares records across incompatible devices or workloads.

## W1 — renderer and TSL foundation

W1 established asynchronous React Three Fiber renderer initialization, actual backend inspection, ephemeris-driven planets, shared production orbit calculations, backend-neutral Node Materials, shared camera controls, frame diagnostics, and complete Canvas remounts during backend switching.

## W2 — KTX2 surfaces and atmospheres

The lab uses a fixed 1K parity tier with 11 unique maps: the Sun, eight planets, Earth clouds, and the shared Saturn/Uranus ring map.

The maps load through `KTX2Loader.detectSupport(WebGPURenderer)`. Procedural TSL colours remain visible while maps load and after any texture failure. W2 also added TSL planetary surfaces, Fresnel-style atmospheres, Earth clouds, radial ring UV reconstruction, and post-load frame sampling.

## W3 — deterministic TSL particles

W3 adds 1,600 deterministic instanced stars and 320 deterministic solar-wind particles. TSL evaluates position, colour, size, opacity, twinkle, radial travel, spiral drift, and fade. JavaScript does not rewrite particle positions each frame.

Runtime contract:

```js
window.__SOLAR_WEBGPU_LAB_EFFECTS__
```

## W4 — TSL Sun presentation

W4 adds an additive BackSide corona, a restrained outer glow, and five fixed torus flare arcs with TSL colour and opacity sweeps. JavaScript creates and disposes geometry and materials but does not rewrite Sun vertices each frame.

Runtime contract:

```js
window.__SOLAR_WEBGPU_LAB_SUN__
```

## W5a — restrained TSL nebula haze

W5a adds two deterministic BackSide haze shells with low-opacity additive Node Materials, fixed transforms and phases, position-derived wave fields, slow material-time animation, no CPU vertex updates, and no post-processing.

Runtime contract, published only while mounted:

```js
window.__SOLAR_WEBGPU_LAB_NEBULA__
```

## W5b — TSL gravitational presentation

W5b adds one deterministic black hole and one deterministic wormhole.

The black hole includes an event-horizon core, TSL halo, two accretion discs, and one photon ring. The wormhole includes two TSL mouth surfaces, one open throat, and animated rim layers. The presentation deliberately avoids physical ray-traced lensing, screen-space distortion, and post-processing.

Runtime contract, published only while mounted:

```js
window.__SOLAR_WEBGPU_LAB_GRAVITY__
```

## W5c — toggleable TSL render pipeline

W5c adds one deliberately small backend-neutral post-processing experiment:

- one TSL scene pass;
- one threshold bloom pass;
- one Three.js `RenderPipeline`;
- strength `0.18`;
- radius `0.16`;
- threshold `0.78`;
- smooth width `0.08`.

The in-panel checkbox switches between `render-pipeline-tsl` and `direct-render` without remounting the renderer. No CPU pixel rewriting or screen-space lensing is used.

Runtime contract:

```js
window.__SOLAR_WEBGPU_LAB_POST__
```

## W6 — real-device benchmark protocol

W6 turns the parity scene into a repeatable evidence recorder.

The benchmark panel provides:

- shared camera position `[0, 34, 62]` and target `[0, 0, 0]`;
- a fresh rolling window after camera preparation, bloom changes, or renderer changes;
- at least 90 fresh frames before a record can be saved;
- automatic invalidation when camera interaction begins;
- session storage for up to 16 records;
- JSON download and clipboard export;
- visible coverage for all four required configurations.

The required physical-device matrix is:

```text
WebGPU + bloom
WebGPU + direct rendering
WebGL 2 + bloom
WebGL 2 + direct rendering
```

A record includes backend and adapter state, fallback reason, initialization time, average/P95/longest frame time, FPS, sample count, renderer counters, KTX2 formats, viewport, DPR, screen, user agent, available hardware hints, exact scene counts, post-processing parameters, and fixed camera/simulation settings.

Runtime contract:

```js
window.__SOLAR_WEBGPU_LAB_BENCHMARK__
```

## W7 — evidence analysis and promotion gate

W7 converts raw captures into a conservative renderer decision.

The evidence workspace can:

- load records from the current benchmark session;
- import multiple JSON exports from physical devices;
- validate schema version and reject incomplete records;
- reject records with fewer than 90 frame samples;
- deduplicate repeated records;
- group records by physical-device/browser environment;
- pair WebGPU and WebGL 2 only when viewport, DPR, camera, simulation, scene workload, texture backend, and texture formats match;
- compare bloom and direct rendering separately;
- use medians when repeated captures exist;
- report average, P95, longest-frame, FPS, and initialization deltas;
- export a decision report containing raw evidence and derived analysis.

Positive percentages mean WebGPU was faster. The recommendation engine is intentionally conservative:

- fewer than two complete devices — insufficient evidence;
- any material matched WebGPU regression — keep WebGL 2;
- at least two complete devices with consistent wins — justify a WebGPU opt-in while keeping WebGL 2 as default;
- at least four complete devices, wins in at least 75% of matched modes, and at least 5% median P95 improvement — consider a controlled WebGPU-default trial.

A complete device has all four configurations. Timing recommendations never replace visual, crash, context/device-loss, thermal, fan, battery, and browser-support review.

Runtime contract:

```js
window.__SOLAR_WEBGPU_BENCHMARK_ANALYSIS__
```

## Runtime diagnostics

The laboratory and evidence workspace publish nine diagnostic surfaces:

```js
window.__SOLAR_WEBGPU_LAB__
window.__SOLAR_WEBGPU_LAB_TEXTURES__
window.__SOLAR_WEBGPU_LAB_EFFECTS__
window.__SOLAR_WEBGPU_LAB_SUN__
window.__SOLAR_WEBGPU_LAB_NEBULA__
window.__SOLAR_WEBGPU_LAB_GRAVITY__
window.__SOLAR_WEBGPU_LAB_POST__
window.__SOLAR_WEBGPU_LAB_BENCHMARK__
window.__SOLAR_WEBGPU_BENCHMARK_ANALYSIS__
```

## Strict release gate

The production-standalone gates verify:

- forced WebGL 2 initialization and capability-aware Auto selection;
- Auto → forced WebGL 2 → Auto remounts;
- all 11 laboratory KTX2 maps with zero failures;
- exact W3 particle, W4 Sun, W5a nebula, and W5b gravitational contracts;
- W5c bloom/direct switching without renderer remount;
- no CPU position, vertex, or pixel rewriting;
- no screen-space distortion;
- fixed-camera preparation and camera-interaction invalidation;
- separate 90-frame bloom and direct benchmark windows;
- session-persistent benchmark records;
- benchmark schema, pairing, regression, and promotion-threshold validation;
- current-session and multi-file evidence import;
- opt-in and controlled-default-trial recommendation rendering;
- no uncaught browser errors or invalid layout.

The repository gate also retains module/dependency audit, clean ESLint, strict TypeScript, ephemeris validation, all 39 production KTX2 files, optimized Next.js build, artifact budgets, and production desktop/mobile/accessibility/recovery tests.

Local validation commands:

```bash
bun run webgpu:smoke
bun run webgpu:benchmark:smoke
bun run webgpu:analysis:validate
bun run webgpu:results:smoke
```

## Hosted-runner WebGPU limitation

GitHub-hosted Chromium exposes `navigator.gpu` but returns no usable core or compatibility Dawn adapter in this workflow. Hosted CI therefore proves correct detection, safe fallback, complete TSL/KTX2 parity on the WebGL 2 backend, stable remounts, the benchmark protocol, and the evidence-analysis rules.

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
7. no significant regression on integrated graphics or mobile hardware;
8. evidence-workspace thresholds reached without thermal or stability regressions.

## Current conclusion

W1 through W7 are complete as an isolated laboratory. The remaining work is evidence collection on physical hardware:

```text
Desktop discrete GPU
Desktop integrated GPU
Android phone
Apple device where WebGPU is available
```

On each device, record the four configurations using the fixed baseline. Import all exported files into `/lab/webgpu/results`. Production should remain WebGL 2 until the resulting recommendation and manual visual/power review justify an opt-in renderer setting or controlled default trial.

## Official references

- Three.js WebGPURenderer manual: https://threejs.org/manual/en/webgpurenderer
- Three.js WebGPURenderer API: https://threejs.org/docs/pages/WebGPURenderer.html
- Three.js TSL specification: https://threejs.org/docs/TSL.html
- React Three Fiber Canvas WebGPU example: https://r3f.docs.pmnd.rs/api/canvas
