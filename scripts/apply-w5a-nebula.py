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
        raise SystemExit(f"Expected block not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def insert_after(path: str, needle: str, addition: str) -> None:
    text = read(path)
    if addition.strip() in text:
        return
    if needle not in text:
        raise SystemExit(f"Insertion point not found in {path}: {needle[:120]!r}")
    write(path, text.replace(needle, needle + addition, 1))


scene = "src/components/solar-system/webgpu/WebGPULabScene.tsx"
insert_after(
    scene,
    "import LabTslSunEffects from './LabSunEffects'\n",
    "import LabTslNebulaHaze from './LabNebulaHaze'\n",
)
insert_after(
    scene,
    "      <color attach=\"background\" args={['#02030a']} />\n",
    "      <LabTslNebulaHaze />\n",
)

smoke = "scripts/smoke-webgpu-lab.mjs"
insert_after(
    smoke,
    "const EXPECTED_SUN_FLARE_ARCS = 5\n",
    "const EXPECTED_NEBULA_SYSTEMS = [\n  'tsl-nebula-inner',\n  'tsl-nebula-outer',\n]\nconst EXPECTED_NEBULA_SHELL_COUNT = 2\n",
)
insert_after(
    smoke,
    "      sunDiagnostics: window.__SOLAR_WEBGPU_LAB_SUN__ ?? null,\n",
    "      nebulaDiagnostics: window.__SOLAR_WEBGPU_LAB_NEBULA__ ?? null,\n",
)
replace_once(
    smoke,
    "        expectedSunSystems,\n        expectedSunFlareArcs\n      ) => {",
    "        expectedSunSystems,\n        expectedSunFlareArcs,\n        expectedNebulaSystems,\n        expectedNebulaShellCount\n      ) => {",
)
replace_once(
    smoke,
    "        const sun = window.__SOLAR_WEBGPU_LAB_SUN__\n        const metrics = diagnostics?.metrics",
    "        const sun = window.__SOLAR_WEBGPU_LAB_SUN__\n        const nebula = window.__SOLAR_WEBGPU_LAB_NEBULA__\n        const metrics = diagnostics?.metrics",
)
replace_once(
    smoke,
    "          && sun.animationMode === 'material-tsl'\n          && sun.cpuVertexUpdates === false\n          && metrics",
    "          && sun.animationMode === 'material-tsl'\n          && sun.cpuVertexUpdates === false\n          && nebula\n          && nebula.visualSystems.length === expectedNebulaSystems.length\n          && expectedNebulaSystems.every((id) => nebula.visualSystems.includes(id))\n          && nebula.shellCount === expectedNebulaShellCount\n          && nebula.animationMode === 'material-tsl'\n          && nebula.cpuVertexUpdates === false\n          && nebula.postProcessing === false\n          && metrics",
)
replace_once(
    smoke,
    "      EXPECTED_SUN_SYSTEMS,\n      EXPECTED_SUN_FLARE_ARCS\n    )",
    "      EXPECTED_SUN_SYSTEMS,\n      EXPECTED_SUN_FLARE_ARCS,\n      EXPECTED_NEBULA_SYSTEMS,\n      EXPECTED_NEBULA_SHELL_COUNT\n    )",
)

nebula_assertion = r'''
async function assertNebulaDiagnostics(page) {
  const nebula = await page.evaluate(() => window.__SOLAR_WEBGPU_LAB_NEBULA__)
  if (!nebula) throw new Error('W5a TSL nebula diagnostics were not published')

  const missingSystems = EXPECTED_NEBULA_SYSTEMS.filter(
    (id) => !nebula.visualSystems.includes(id)
  )
  const unexpectedSystems = nebula.visualSystems.filter(
    (id) => !EXPECTED_NEBULA_SYSTEMS.includes(id)
  )

  if (missingSystems.length || unexpectedSystems.length) {
    throw new Error(
      `Unexpected W5a nebula systems: ${JSON.stringify({ missingSystems, unexpectedSystems })}`
    )
  }
  if (nebula.shellCount !== EXPECTED_NEBULA_SHELL_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_NEBULA_SHELL_COUNT} nebula shells, received ${nebula.shellCount}`
    )
  }
  if (
    nebula.animationMode !== 'material-tsl'
    || nebula.cpuVertexUpdates !== false
    || nebula.postProcessing !== false
  ) {
    throw new Error(`W5a nebula contract failed: ${JSON.stringify(nebula)}`)
  }

  return nebula
}

'''
text = read(smoke)
if "async function assertNebulaDiagnostics(page)" not in text:
    marker = "function assertDiagnostics(diagnostics, requested, actual) {"
    if marker not in text:
        raise SystemExit("Could not insert W5a nebula assertion")
    text = text.replace(marker, nebula_assertion + marker, 1)
    write(smoke, text)

text = read(smoke)
text = text.replace(
    "  const sun = await assertSunDiagnostics(page)\n",
    "  const sun = await assertSunDiagnostics(page)\n  const nebula = await assertNebulaDiagnostics(page)\n",
)
text = text.replace(
    "  await assertSunDiagnostics(page)\n  assertDiagnostics(forcedDiagnostics",
    "  await assertSunDiagnostics(page)\n  await assertNebulaDiagnostics(page)\n  assertDiagnostics(forcedDiagnostics",
)
text = text.replace(
    "  const restoredSun = await assertSunDiagnostics(page)\n",
    "  const restoredSun = await assertSunDiagnostics(page)\n  const restoredNebula = await assertNebulaDiagnostics(page)\n",
)
text = text.replace("!text.includes('W4 parity scope')", "!text.includes('W5a parity scope')")
text = text.replace(
    "    || !text.includes('Material TSL')\n",
    "    || !text.includes('Material TSL')\n    || !text.includes('Nebula TSL')\n",
    1,
)
text = text.replace(
    "throw new Error('Forced WebGL 2 lab UI did not render the W4 controls')",
    "throw new Error('Forced WebGL 2 lab UI did not render the W5a controls')",
)
text = text.replace("{ diagnostics, effects, sun })", "{ diagnostics, effects, sun, nebula })")
text = text.replace(
    "{ diagnostics: restoredDiagnostics, effects: restoredEffects, sun: restoredSun })",
    "{ diagnostics: restoredDiagnostics, effects: restoredEffects, sun: restoredSun, nebula: restoredNebula })",
)
text = text.replace(" W4 diagnostics:", " W5a diagnostics:")
text = text.replace("Incomplete W4 texture set", "Incomplete W5a texture set")
text = text.replace("W4 TSL particle diagnostics", "W5a TSL particle diagnostics")
text = text.replace("Unexpected W4 particle systems", "Unexpected W5a particle systems")
text = text.replace("W4 particle animation contract", "W5a particle animation contract")
text = text.replace("forced WebGL 2 W4", "forced WebGL 2 W5a")
text = text.replace("auto W4 selected", "auto W5a selected")
text = text.replace("auto W4 restored", "auto W5a restored")
text = text.replace("real WebGPU W4", "real WebGPU W5a")
write(smoke, text)

old_status = Path("src/components/solar-system/webgpu/LabW4Status.tsx")
new_status = Path("src/components/solar-system/webgpu/LabW5aStatus.tsx")
new_status.write_text("""'use client'

import {
  LAB_NEBULA_SHELL_COUNT,
  LAB_NEBULA_SYSTEM_IDS,
} from './LabNebulaHaze'
import {
  LAB_SUN_EFFECT_IDS,
  LAB_SUN_FLARE_ARCS,
} from './LabSunEffects'

export default function LabW5aStatus() {
  return (
    <aside className=\"pointer-events-none fixed bottom-3 right-3 z-30 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-cyan-200/10 bg-[#04070d]/84 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5\">
      <div className=\"flex items-center justify-between gap-3\">
        <div>
          <p className=\"text-[8px] font-semibold uppercase tracking-[0.2em] text-cyan-100/45\">
            W5a parity scope
          </p>
          <h2 className=\"mt-1 text-[11px] font-semibold text-white/80\">
            TSL space presentation
          </h2>
        </div>
        <span className=\"rounded-full border border-cyan-200/10 bg-cyan-200/[0.06] px-2 py-1 font-mono text-[8px] font-semibold text-cyan-100/65\">
          Nebula TSL
        </span>
      </div>

      <div className=\"mt-3 grid grid-cols-4 gap-1.5 font-mono text-[8px] text-white/38\">
        <div className=\"rounded-xl border border-white/6 bg-black/20 px-2 py-2\">
          <span className=\"block text-white/25\">sun</span>
          <span className=\"mt-0.5 block text-white/65\">{LAB_SUN_EFFECT_IDS.length}</span>
        </div>
        <div className=\"rounded-xl border border-white/6 bg-black/20 px-2 py-2\">
          <span className=\"block text-white/25\">flares</span>
          <span className=\"mt-0.5 block text-white/65\">{LAB_SUN_FLARE_ARCS}</span>
        </div>
        <div className=\"rounded-xl border border-white/6 bg-black/20 px-2 py-2\">
          <span className=\"block text-white/25\">nebula</span>
          <span className=\"mt-0.5 block text-white/65\">{LAB_NEBULA_SHELL_COUNT}</span>
        </div>
        <div className=\"rounded-xl border border-white/6 bg-black/20 px-2 py-2\">
          <span className=\"block text-white/25\">CPU verts</span>
          <span className=\"mt-0.5 block text-white/65\">0</span>
        </div>
      </div>

      <p className=\"mt-3 text-[8px] leading-relaxed text-white/32\">
        {LAB_NEBULA_SYSTEM_IDS.length} restrained background shells and the W4 Sun layers animate in material-node graphs without post-processing or JavaScript vertex rewrites.
      </p>
    </aside>
  )
}
""")
if old_status.exists():
    old_status.unlink()

page = "src/app/lab/webgpu/page.tsx"
page_text = read(page)
page_text = page_text.replace(
    "import LabW4Status from '../../../components/solar-system/webgpu/LabW4Status'",
    "import LabW5aStatus from '../../../components/solar-system/webgpu/LabW5aStatus'",
)
page_text = page_text.replace("<LabW4Status />", "<LabW5aStatus />")
write(page, page_text)

Path(".github/workflows/apply-w5a-nebula.yml").unlink(missing_ok=True)
Path(__file__).unlink()
