# WebGPU / TSL Laboratory

The laboratory at `/lab/webgpu` evaluates Three.js's universal `WebGPURenderer` without changing the production explorer at `/`.

Production remains on the established `WebGLRenderer` / WebGL 2 architecture. The lab is an evidence-gathering route, not a renderer migration flag.

## Why the route is isolated

Three.js documents several important boundaries:

- `WebGPURenderer` initializes asynchronously.
- It attempts WebGPU first and can use a WebGL 2 backend when WebGPU is unavailable.
- `forceWebGL: true` selects the WebGL 2 backend deliberately for comparison.
- legacy `ShaderMaterial`, `RawShaderMaterial`, and `onBeforeCompile()` customizations are not supported and must move to node materials and TSL.
- renderer maturity and performance remain scene-dependent, so WebGPU must be measured rather than assumed to be faster.

The current production scene includes many legacy GLSL effects. Moving the whole application in one renderer swap would hide visual omissions and make performance results impossible to interpret.

## W1 parity scene

The first milestone renders only:

- the Sun
- Mercury through Neptune
- shared ephemeris positions from the production orbital engine
- orbit curves
- a deterministic star field
- one shared camera and control configuration
- TSL colour graphs on `MeshBasicNodeMaterial` and `MeshStandardNodeMaterial`

It intentionally excludes production GLSL effects, post-processing, black holes, wormholes, nebulae, meteors, and other optional systems.

## Backend modes

### Auto WebGPU

```text
/lab/webgpu
```

Creates `WebGPURenderer` with its default backend selection. The actual result can be:

```text
WebGPUBackend
WebGLBackend
```

The UI and diagnostics show the backend selected after `renderer.init()`; `navigator.gpu` alone is not treated as proof.

### Forced WebGL 2

```text
/lab/webgpu?backend=webgl
```

Creates the same renderer with `forceWebGL: true`. Geometry, TSL graphs, camera, date, animation rate, DPR bounds, and controls remain identical.

## Runtime diagnostics

The lab publishes:

```js
window.__SOLAR_WEBGPU_LAB__
```

The object contains:

- requested backend mode
- actual backend
- backend class
- WebGPU API availability
- compatibility-mode state when available
- renderer initialization time
- rolling FPS and frame-time samples

The UI reports average, P95, and longest frame time rather than relying on FPS alone.

## Comparison rules

A valid comparison keeps these constant:

- Three.js and R3F versions
- viewport and DPR
- camera position
- date and time rate
- object count
- geometry detail
- TSL material graph
- lighting
- browser and device

The lab currently uses Three.js r184, matching production and the latest release available when W1 was created.

## Promotion boundary

The production renderer must not change until the lab demonstrates:

1. visual parity for every migrated system
2. no silent WebGL fallback during claimed WebGPU tests
3. acceptable initialization and shader-compilation behavior
4. stable camera, selection, KTX2, screenshots, and recovery
5. measurable improvement or another concrete benefit on target devices
6. reliable WebGL 2 fallback
7. no significant regression on integrated graphics or mobile hardware

## Planned migration order

```text
W1  core Sun, planets, orbits, TSL diagnostics
W2  KTX2 surface textures and simple atmospheres
W3  stars, solar wind, and meteor particles
W4  procedural Sun corona, glow, and flares
W5  nebula, black holes, wormholes, and post-processing
```

Each milestone should compare Auto WebGPU, actual backend, and forced WebGL 2 before the next visual system is added.

## Official references

- Three.js WebGPURenderer manual: https://threejs.org/manual/en/webgpurenderer
- Three.js WebGPURenderer API: https://threejs.org/docs/pages/WebGPURenderer.html
- Three.js TSL specification: https://threejs.org/docs/TSL.html
- React Three Fiber Canvas WebGPU example: https://r3f.docs.pmnd.rs/api/canvas
