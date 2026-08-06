# P2 Device Acceptance and Merge Readiness

Production stays on WebGL 2. This phase does not promote WebGPU; it establishes the physical-device evidence and review gate required before the integrated runtime branch can move out of draft.

## Routes

Capture evidence on each physical device at:

```text
/lab/device-acceptance
```

Combine and review exported bundles at:

```text
/lab/device-acceptance/results
```

The capture route runs the same production `SceneContainer` used by the main explorer. The results route does not render a benchmark mock; it analyzes the exported production diagnostics, human approvals, screenshots, thermal samples, recovery events, and commit provenance.

All evidence remains in browser local storage until it is explicitly exported or imported. Nothing is uploaded automatically.

## Required device matrix

Capture one exported JSON bundle from each class:

1. Intel or AMD integrated-graphics laptop.
2. Desktop with a discrete GPU.
3. Android phone in portrait and landscape.

Give each device a clear label containing the model and GPU when known. All bundles used for one merge decision should come from the same deployed commit.

## Per-device capture procedure

### 1. Visual and interaction pass

For Eco, Balanced, and Ultra:

1. Select the quality profile.
2. Wait until the panel reports **Settled**.
3. Orbit, zoom, search, select several bodies, open and close panels, and use the guided interactions.
4. Download a screenshot from the acceptance panel.
5. Confirm there are no missing planets, black surfaces, broken transparency, unreadable labels, or overlapping mobile controls.
6. Mark the corresponding visual-parity checklist item.

Ultra is still captured on lower-end devices. Low performance may be expected there, but a renderer crash, missing scene, or unrecovered context is not acceptable.

### 2. Primary profile capture

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
- texture, geometry, and heap counters for unexpected growth;
- context-loss events;
- responsiveness near the end of the session.

A sustained FPS decline above 20% requires review. Above 30% is an automated failure signal.

### 4. Display sleep and resume

Start a capture, press **Sleep marker**, then lock the display or allow the display to sleep. Return to the browser and confirm:

- simulation does not jump uncontrollably;
- the scene renders again;
- selected body and settings remain intact;
- frame pacing leaves suspended or static state;
- no unrecovered WebGL context remains.

Mark the sleep/resume checklist item only after the scene behaves correctly.

### 5. WebGL context recovery

During an active capture, press **GPU recovery**. On browsers exposing `WEBGL_lose_context`, the lab requests a context loss and restores it after a short delay.

Confirm that the recovery screen appears and the scene returns without losing application state. The session should contain matching `context-lost` and `context-restored` events.

Some mobile browsers do not expose the testing extension. In that case, use display sleep/resume and document the limitation in notes with wording such as `WEBGL_lose_context unavailable on this browser`.

### 6. Export

Press **Export JSON** after screenshots, profile capture, thermal capture, and checklist completion. Keep the downloaded screenshots beside the JSON file using their generated names.

## Automated session signals

A capture can report:

- **Pass** — runtime signals stayed inside the device/profile envelope.
- **Review** — evidence is incomplete or performance is below the preferred floor but not catastrophically broken.
- **Fail** — too few samples, very low diagnostics coverage, shared-clock divergence, unrecovered context loss, severe frame-lane cost, or severe sustained degradation.

A merge-ready device still requires human visual approval even when all automated sessions pass.

## P2.2 evidence review workspace

Open `/lab/device-acceptance/results` after the three device bundles have been exported.

The workspace supports:

- importing one or many JSON files;
- loading the current browser's local capture workspace;
- schema validation and normalization;
- duplicate-bundle removal;
- one authoritative cross-device matrix;
- primary-profile and thermal-session selection;
- Eco, Balanced, and Ultra screenshot coverage;
- Android portrait and landscape enforcement;
- sleep/resume and context-recovery evidence;
- thermal texture, geometry, and heap-drift checks;
- shared-clock and unrecovered-context checks;
- deployment commit consistency;
- JSON and Markdown merge-readiness reports.

### Overall review verdicts

The results workspace reports:

- **Ready** — all three required device classes satisfy the automated and human evidence gate with one commit provenance and no warnings.
- **Review** — there is no hard failure, but one or more signals require human attention, such as incomplete GPU identity, missing visibility transitions, absent deployment SHA, or moderate resource drift.
- **Blocked** — required hardware evidence is missing, a primary or thermal session fails, visual or orientation approval is absent, context loss is unrecovered, the shared-clock invariant fails, resource growth is severe, or bundles span multiple commits.

The reviewer workspace combines multiple bundles from the same device class when needed, but it warns when a class is represented by more than one export. Remove stale bundles before final approval.

### Resource stability thresholds

For the selected thermal session:

- more than two additional resident textures blocks readiness;
- more than twelve additional geometries blocks readiness;
- more than four additional geometries requires review;
- heap growth above 64 MB and 50% blocks readiness;
- heap growth above 32 MB and 25% requires review.

Heap evidence is optional because it is not exposed by every browser. Texture and geometry evidence comes from the production renderer diagnostics.

## Merge-readiness gate

The draft PR should move to ready-for-review only when the results workspace reports **Ready** and all of the following are available:

- one accepted bundle from each required device class;
- all evidence from one deployed commit;
- Eco, Balanced, and Ultra screenshots;
- phone portrait and landscape approval;
- one completed primary-profile session per device;
- one completed 10–15 minute thermal session per device;
- sleep/resume approval;
- context-recovery approval or a documented browser limitation;
- no unrecovered context loss;
- no shared-clock invariant failure;
- no unexplained texture, geometry, or heap growth;
- no unresolved visual or interaction regression;
- exported JSON and Markdown merge-readiness reports.

Keep production on WebGL 2 after this gate. WebGPU remains a separate laboratory decision backed by its own benchmark evidence.
