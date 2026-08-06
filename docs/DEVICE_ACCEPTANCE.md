# P2.1 Physical-Device Acceptance

Production stays on WebGL 2. This phase does not promote WebGPU; it establishes the evidence required to decide whether the integrated runtime branch is ready for review and merge.

## Acceptance route

Open:

```text
/lab/device-acceptance
```

The route runs the same production `SceneContainer` used by the main explorer, but replaces the normal interface with a compact evidence panel. Diagnostics are enabled automatically and all captured information stays in browser local storage until it is exported.

## Required device matrix

Capture one exported JSON bundle from each of these classes:

1. Intel or AMD integrated-graphics laptop.
2. Desktop with a discrete GPU.
3. Android phone in portrait and landscape.

Give each device a clear label containing the model and GPU when known.

## Per-device procedure

### 1. Visual and interaction pass

For Eco, Balanced, and Ultra:

1. Select the quality profile.
2. Wait until the panel reports **Settled**.
3. Orbit, zoom, search, select several bodies, open and close panels, and use the guided interactions.
4. Download a screenshot from the acceptance panel.
5. Confirm there are no missing planets, black surfaces, broken transparency, unreadable labels, or overlapping mobile controls.
6. Mark the corresponding visual-parity checklist item.

Ultra is still captured on lower-end devices. A low-performance result may be expected there, but a renderer crash, missing scene, or unrecovered context is not acceptable.

### 2. Profile capture

Run a 60-second profile capture at the profile appropriate for the device:

| Device | Primary profile |
| --- | --- |
| Android phone | Eco |
| Integrated laptop | Balanced |
| Discrete desktop | Ultra |

Interact naturally during the capture. The exported session includes renderer counters, frame pacing, frame-lane cost, scene-loading state, texture residency, LOD state, battery level when available, heap hints when available, orientation, visibility transitions, and the shared-clock invariant.

The automated verdict is a signal, not a substitute for visual approval.

### 3. Thermal and battery capture

Run a 15-minute thermal capture using the primary profile. Keep the scene visible and interact periodically.

Review:

- first-window versus last-window median FPS;
- battery percentage change when the Battery Status API is available;
- fan noise or device warmth in the notes field;
- renderer, texture, and heap counters for unexpected growth;
- context-loss events;
- responsiveness near the end of the session.

A sustained FPS decline above 20% requires review. Above 30% is an automated failure signal.

### 4. Display sleep and resume

Start a capture, press **Sleep marker**, then lock the display or allow the display to sleep. Return to the browser and confirm:

- simulation does not jump uncontrollably;
- the scene renders again;
- selected body and settings remain intact;
- frame pacing leaves suspended/static state;
- no unrecovered WebGL context remains.

Mark the sleep/resume checklist item only after the scene behaves correctly.

### 5. WebGL context recovery

During an active capture, press **GPU recovery**. On browsers exposing `WEBGL_lose_context`, the lab requests a context loss and restores it after a short delay.

Confirm that the recovery screen appears and the scene returns without losing application state. The session must contain matching `context-lost` and `context-restored` events.

Some mobile browsers do not expose the testing extension. In that case, use display sleep/resume and record the limitation in notes.

### 6. Export

Press **Export JSON** after screenshots, profile capture, thermal capture, and checklist completion. Keep the downloaded screenshots beside the JSON file using their generated names.

## Automated acceptance signals

A session can report:

- **Pass** — runtime signals stayed inside the device/profile envelope.
- **Review** — evidence is incomplete or performance is below the preferred floor but not catastrophically broken.
- **Fail** — too few samples, very low diagnostics coverage, shared-clock divergence, unrecovered context loss, severe frame-lane cost, or severe sustained degradation.

A merge-ready device still requires human visual approval even when all automated sessions pass.

## Merge-readiness gate

The draft PR should move to ready-for-review only when all of the following are available:

- one exported bundle from each required device class;
- Eco, Balanced, and Ultra screenshots;
- phone portrait and landscape approval;
- one completed thermal session per device;
- sleep/resume approval;
- context-recovery approval or a documented browser limitation;
- no unrecovered context loss;
- no shared-clock invariant failure;
- no unexplained texture, geometry, or heap growth;
- no unresolved visual or interaction regression.

Keep production on WebGL 2 after this gate. WebGPU remains a separate laboratory decision backed by its own benchmark evidence.
