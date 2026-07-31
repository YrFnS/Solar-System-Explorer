from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:160]!r}")
    write(path, text.replace(old, new, 1))


def insert_after(path: str, needle: str, addition: str) -> None:
    text = read(path)
    if addition.strip() in text:
        return
    if needle not in text:
        raise SystemExit(f"Insertion point not found in {path}: {needle[:160]!r}")
    write(path, text.replace(needle, needle + addition, 1))


scene = "src/components/solar-system/webgpu/WebGPULabScene.tsx"
insert_after(
    scene,
    "import LabTslGravitationalObjects from './LabGravitationalObjects'\n",
    "import LabTslPostProcessing from './LabPostProcessing'\n",
)
replace_once(
    scene,
    "interface WebGPULabSceneProps {\n  onMetrics: (metrics: LabFrameMetrics) => void\n}",
    "interface WebGPULabSceneProps {\n  onMetrics: (metrics: LabFrameMetrics) => void\n  postProcessingEnabled: boolean\n}",
)
replace_once(
    scene,
    "export default function WebGPULabScene({ onMetrics }: WebGPULabSceneProps) {",
    "export default function WebGPULabScene({\n  onMetrics,\n  postProcessingEnabled,\n}: WebGPULabSceneProps) {",
)
insert_after(
    scene,
    "      <LabMetricsProbe onMetrics={onMetrics} />\n",
    "      <LabTslPostProcessing enabled={postProcessingEnabled} />\n",
)

lab = "src/components/solar-system/webgpu/WebGPULab.tsx"
insert_after(
    lab,
    "  textureLastError: string | null\n",
    "  postProcessingEnabled: boolean\n",
)
insert_after(
    lab,
    "function readRequestedBackend(): RequestedBackend {\n  if (typeof window === 'undefined') return 'auto'\n  return new URLSearchParams(window.location.search).get('backend') === 'webgl'\n    ? 'webgl'\n    : 'auto'\n}\n",
    "\nfunction readPostProcessingEnabled() {\n  if (typeof window === 'undefined') return true\n  return new URLSearchParams(window.location.search).get('post') !== 'off'\n}\n",
)
insert_after(
    lab,
    "  const [metrics, setMetrics] = useState<LabFrameMetrics | null>(null)\n",
    "  const [postProcessingEnabled, setPostProcessingEnabled] = useState(\n    readPostProcessingEnabled\n  )\n",
)
insert_after(
    lab,
    "  }, [requestedBackend, resetTextures])\n",
    "\n  const togglePostProcessing = useCallback((enabled: boolean) => {\n    setPostProcessingEnabled(enabled)\n    setMetrics(null)\n\n    const url = new URL(window.location.href)\n    if (enabled) url.searchParams.delete('post')\n    else url.searchParams.set('post', 'off')\n    window.history.replaceState(null, '', url)\n  }, [])\n",
)
insert_after(
    lab,
    "      textureLastError,\n",
    "      postProcessingEnabled,\n",
)
insert_after(
    lab,
    "    textureLoadedIds,\n",
    "    postProcessingEnabled,\n",
)
replace_once(
    lab,
    "          <WebGPULabScene onMetrics={handleMetrics} />",
    "          <WebGPULabScene\n            onMetrics={handleMetrics}\n            postProcessingEnabled={postProcessingEnabled}\n          />",
)
replace_once(
    lab,
    "              A KTX2-textured parity scene with backend-neutral planets, TSL atmospheres, and vertex-animated star and solar-wind fields. Production remains unchanged on WebGL 2.",
    "              A KTX2-textured parity scene with backend-neutral planets, TSL atmospheres, GPU particle fields, gravitational objects, and an optional TSL bloom pipeline. Production remains unchanged on WebGL 2.",
)

post_ui = '''

            <div className="rounded-2xl border border-fuchsia-200/10 bg-fuchsia-200/[0.025] p-3.5">
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span>
                  <span className="block text-[8px] font-semibold uppercase tracking-[0.18em] text-fuchsia-100/45">
                    Render pipeline
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold text-white/76">
                    Threshold bloom
                  </span>
                  <span className="mt-1 block text-[8px] leading-relaxed text-white/32">
                    One scene pass plus low-strength TSL bloom. Disable it for a direct-render comparison without remounting the backend.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={postProcessingEnabled}
                  onChange={(event) => togglePostProcessing(event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-fuchsia-200"
                  aria-label="Enable TSL bloom post-processing"
                />
              </label>
              <div className="mt-2 flex items-center justify-between font-mono text-[8px] text-white/35">
                <span>Post FX TSL</span>
                <span>{postProcessingEnabled ? 'pipeline active' : 'direct render'}</span>
              </div>
            </div>
'''
text = read(lab)
marker = '''            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/30">
                Post-load frame sample
'''
if post_ui.strip() not in text:
    if marker not in text:
        raise SystemExit('Could not insert W5c post-processing control')
    text = text.replace(marker, post_ui + "\n" + marker, 1)
write(lab, text)

text = read(lab)
text = text.replace('W3 parity scope', 'W5c parity scope', 1)
text = text.replace(
    '<li>• TSL surfaces, clouds, rings, and atmospheres</li>',
    '<li>• TSL surfaces, clouds, rings, and atmospheres</li>\n                <li>• TSL Sun, nebula, black-hole, and wormhole presentation</li>\n                <li>• Toggleable RenderPipeline threshold bloom with direct-render comparison</li>',
    1,
)
write(lab, text)

smoke = "scripts/smoke-webgpu-lab.mjs"
insert_after(
    smoke,
    "const EXPECTED_WORMHOLE_MOUTH_COUNT = 2\n",
    "const EXPECTED_POST_SYSTEMS = [\n  'tsl-scene-pass',\n  'tsl-threshold-bloom',\n  'tsl-render-pipeline',\n]\nconst EXPECTED_POST_PIPELINE_COUNT = 1\nconst EXPECTED_POST_SCENE_PASS_COUNT = 1\nconst EXPECTED_POST_BLOOM_PASS_COUNT = 1\n",
)
insert_after(
    smoke,
    "      gravityDiagnostics: window.__SOLAR_WEBGPU_LAB_GRAVITY__ ?? null,\n",
    "      postDiagnostics: window.__SOLAR_WEBGPU_LAB_POST__ ?? null,\n",
)
replace_once(
    smoke,
    "        expectedWormholeCount,\n        expectedWormholeMouthCount\n      ) => {",
    "        expectedWormholeCount,\n        expectedWormholeMouthCount,\n        expectedPostSystems,\n        expectedPostPipelineCount,\n        expectedPostScenePassCount,\n        expectedPostBloomPassCount\n      ) => {",
)
replace_once(
    smoke,
    "        const gravity = window.__SOLAR_WEBGPU_LAB_GRAVITY__\n        const metrics = diagnostics?.metrics",
    "        const gravity = window.__SOLAR_WEBGPU_LAB_GRAVITY__\n        const post = window.__SOLAR_WEBGPU_LAB_POST__\n        const metrics = diagnostics?.metrics",
)
replace_once(
    smoke,
    "          && gravity.screenSpaceDistortion === false\n          && metrics",
    "          && gravity.screenSpaceDistortion === false\n          && diagnostics.postProcessingEnabled === true\n          && post\n          && post.visualSystems.length === expectedPostSystems.length\n          && expectedPostSystems.every((id) => post.visualSystems.includes(id))\n          && post.enabled === true\n          && post.pipelineCount === expectedPostPipelineCount\n          && post.scenePassCount === expectedPostScenePassCount\n          && post.bloomPassCount === expectedPostBloomPassCount\n          && post.renderMode === 'render-pipeline-tsl'\n          && post.cpuPixelUpdates === false\n          && post.screenSpaceDistortion === false\n          && metrics",
)
replace_once(
    smoke,
    "      EXPECTED_WORMHOLE_COUNT,\n      EXPECTED_WORMHOLE_MOUTH_COUNT\n    )",
    "      EXPECTED_WORMHOLE_COUNT,\n      EXPECTED_WORMHOLE_MOUTH_COUNT,\n      EXPECTED_POST_SYSTEMS,\n      EXPECTED_POST_PIPELINE_COUNT,\n      EXPECTED_POST_SCENE_PASS_COUNT,\n      EXPECTED_POST_BLOOM_PASS_COUNT\n    )",
)

post_assertion = r'''
async function assertPostDiagnostics(page, expectedEnabled = true) {
  const post = await page.evaluate(() => window.__SOLAR_WEBGPU_LAB_POST__)
  if (!post) throw new Error('W5c TSL post-processing diagnostics were not published')

  const missingSystems = EXPECTED_POST_SYSTEMS.filter(
    (id) => !post.visualSystems.includes(id)
  )
  const unexpectedSystems = post.visualSystems.filter(
    (id) => !EXPECTED_POST_SYSTEMS.includes(id)
  )

  if (missingSystems.length || unexpectedSystems.length) {
    throw new Error(
      `Unexpected W5c post systems: ${JSON.stringify({ missingSystems, unexpectedSystems })}`
    )
  }
  if (post.enabled !== expectedEnabled) {
    throw new Error(
      `Expected post-processing enabled=${expectedEnabled}, received ${post.enabled}`
    )
  }
  if (
    post.pipelineCount !== EXPECTED_POST_PIPELINE_COUNT
    || post.scenePassCount !== EXPECTED_POST_SCENE_PASS_COUNT
    || post.bloomPassCount !== EXPECTED_POST_BLOOM_PASS_COUNT
  ) {
    throw new Error(`W5c pass-count contract failed: ${JSON.stringify(post)}`)
  }
  const expectedMode = expectedEnabled ? 'render-pipeline-tsl' : 'direct-render'
  if (
    post.renderMode !== expectedMode
    || post.cpuPixelUpdates !== false
    || post.screenSpaceDistortion !== false
  ) {
    throw new Error(`W5c post-processing contract failed: ${JSON.stringify(post)}`)
  }

  return post
}

async function assertPostToggle(page) {
  const toggle = await page.waitForSelector(
    '[aria-label="Enable TSL bloom post-processing"]',
    { timeout: 15_000 }
  )
  const initiallyChecked = await toggle.evaluate((element) => element.checked)
  if (!initiallyChecked) throw new Error('W5c bloom toggle was not enabled initially')

  await toggle.click()
  await page.waitForFunction(() => {
    const post = window.__SOLAR_WEBGPU_LAB_POST__
    return post?.enabled === false && post.renderMode === 'direct-render'
  }, { timeout: 20_000 })
  await assertPostDiagnostics(page, false)

  await toggle.click()
  await page.waitForFunction(() => {
    const post = window.__SOLAR_WEBGPU_LAB_POST__
    return post?.enabled === true && post.renderMode === 'render-pipeline-tsl'
  }, { timeout: 20_000 })
  return assertPostDiagnostics(page, true)
}

'''
text = read(smoke)
if "async function assertPostDiagnostics(page" not in text:
    marker = "function assertDiagnostics(diagnostics, requested, actual) {"
    if marker not in text:
        raise SystemExit('Could not insert W5c post assertions')
    text = text.replace(marker, post_assertion + marker, 1)
write(smoke, text)

text = read(smoke)
text = text.replace(
    "  const gravity = await assertGravityDiagnostics(page)\n",
    "  const gravity = await assertGravityDiagnostics(page)\n  let post = await assertPostDiagnostics(page)\n",
)
text = text.replace(
    "    || !text.includes('Gravity TSL')\n",
    "    || !text.includes('Gravity TSL')\n    || !text.includes('Post FX TSL')\n",
    1,
)
text = text.replace(
    "  if (failures.length > 0) {",
    "  post = await assertPostToggle(page)\n\n  if (failures.length > 0) {",
    1,
)
text = text.replace(
    "{ diagnostics, effects, sun, nebula, gravity })",
    "{ diagnostics, effects, sun, nebula, gravity, post })",
)
text = text.replace(
    "  await assertGravityDiagnostics(page)\n  assertDiagnostics(forcedDiagnostics",
    "  await assertGravityDiagnostics(page)\n  await assertPostDiagnostics(page)\n  assertDiagnostics(forcedDiagnostics",
)
text = text.replace(
    "  const restoredGravity = await assertGravityDiagnostics(page)\n",
    "  const restoredGravity = await assertGravityDiagnostics(page)\n  const restoredPost = await assertPostDiagnostics(page)\n",
)
text = text.replace(
    "{ diagnostics: restoredDiagnostics, effects: restoredEffects, sun: restoredSun, nebula: restoredNebula, gravity: restoredGravity })",
    "{ diagnostics: restoredDiagnostics, effects: restoredEffects, sun: restoredSun, nebula: restoredNebula, gravity: restoredGravity, post: restoredPost })",
)
text = text.replace("W5b", "W5c")
write(smoke, text)

old_status = Path("src/components/solar-system/webgpu/LabW5bStatus.tsx")
new_status = Path("src/components/solar-system/webgpu/LabW5cStatus.tsx")
new_status.write_text('''\'use client\'

import {
  LAB_POST_BLOOM_PASS_COUNT,
  LAB_POST_RADIUS,
  LAB_POST_STRENGTH,
  LAB_POST_THRESHOLD,
} from './LabPostProcessing'

export default function LabW5cStatus() {
  return (
    <aside className="pointer-events-none fixed bottom-3 right-3 z-30 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-fuchsia-200/10 bg-[#04070d]/86 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-fuchsia-100/45">
            W5c parity scope
          </p>
          <h2 className="mt-1 text-[11px] font-semibold text-white/80">
            TSL render pipeline
          </h2>
        </div>
        <span className="rounded-full border border-fuchsia-200/10 bg-fuchsia-200/[0.06] px-2 py-1 font-mono text-[8px] font-semibold text-fuchsia-100/65">
          Material TSL · Nebula TSL · Gravity TSL · Post FX TSL
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5 font-mono text-[8px] text-white/38">
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">bloom</span>
          <span className="mt-0.5 block text-white/65">{LAB_POST_BLOOM_PASS_COUNT}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">strength</span>
          <span className="mt-0.5 block text-white/65">{LAB_POST_STRENGTH}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">radius</span>
          <span className="mt-0.5 block text-white/65">{LAB_POST_RADIUS}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">threshold</span>
          <span className="mt-0.5 block text-white/65">{LAB_POST_THRESHOLD}</span>
        </div>
      </div>

      <p className="mt-3 text-[8px] leading-relaxed text-white/32">
        One scene pass feeds restrained threshold bloom through Three.js RenderPipeline. The in-panel toggle switches to direct rendering without remounting the renderer.
      </p>
    </aside>
  )
}
'''.replace("\\'use client\\'", "'use client'"))
if old_status.exists():
    old_status.unlink()

page = "src/app/lab/webgpu/page.tsx"
page_text = read(page)
page_text = page_text.replace(
    "import LabW5bStatus from '../../../components/solar-system/webgpu/LabW5bStatus'",
    "import LabW5cStatus from '../../../components/solar-system/webgpu/LabW5cStatus'",
)
page_text = page_text.replace("<LabW5bStatus />", "<LabW5cStatus />")
write(page, page_text)

Path(__file__).unlink()
