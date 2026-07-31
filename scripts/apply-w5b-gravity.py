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
        raise SystemExit(f"Expected block not found in {path}: {old[:140]!r}")
    write(path, text.replace(old, new, 1))


def insert_after(path: str, needle: str, addition: str) -> None:
    text = read(path)
    if addition.strip() in text:
        return
    if needle not in text:
        raise SystemExit(f"Insertion point not found in {path}: {needle[:140]!r}")
    write(path, text.replace(needle, needle + addition, 1))


scene = "src/components/solar-system/webgpu/WebGPULabScene.tsx"
insert_after(
    scene,
    "import LabTslNebulaHaze from './LabNebulaHaze'\n",
    "import LabTslGravitationalObjects from './LabGravitationalObjects'\n",
)
insert_after(
    scene,
    "      <LabTslNebulaHaze />\n",
    "      <LabTslGravitationalObjects />\n",
)

smoke = "scripts/smoke-webgpu-lab.mjs"
insert_after(
    smoke,
    "const EXPECTED_NEBULA_SHELL_COUNT = 2\n",
    "const EXPECTED_GRAVITY_SYSTEMS = [\n  'tsl-black-hole-shadow',\n  'tsl-black-hole-accretion',\n  'tsl-black-hole-photon-ring',\n  'tsl-wormhole-mouths',\n  'tsl-wormhole-throat',\n  'tsl-wormhole-rims',\n]\nconst EXPECTED_GRAVITY_OBJECT_COUNT = 2\nconst EXPECTED_BLACK_HOLE_COUNT = 1\nconst EXPECTED_ACCRETION_DISC_COUNT = 2\nconst EXPECTED_WORMHOLE_COUNT = 1\nconst EXPECTED_WORMHOLE_MOUTH_COUNT = 2\n",
)
insert_after(
    smoke,
    "      nebulaDiagnostics: window.__SOLAR_WEBGPU_LAB_NEBULA__ ?? null,\n",
    "      gravityDiagnostics: window.__SOLAR_WEBGPU_LAB_GRAVITY__ ?? null,\n",
)
replace_once(
    smoke,
    "        expectedNebulaSystems,\n        expectedNebulaShellCount\n      ) => {",
    "        expectedNebulaSystems,\n        expectedNebulaShellCount,\n        expectedGravitySystems,\n        expectedGravityObjectCount,\n        expectedBlackHoleCount,\n        expectedAccretionDiscCount,\n        expectedWormholeCount,\n        expectedWormholeMouthCount\n      ) => {",
)
replace_once(
    smoke,
    "        const nebula = window.__SOLAR_WEBGPU_LAB_NEBULA__\n        const metrics = diagnostics?.metrics",
    "        const nebula = window.__SOLAR_WEBGPU_LAB_NEBULA__\n        const gravity = window.__SOLAR_WEBGPU_LAB_GRAVITY__\n        const metrics = diagnostics?.metrics",
)
replace_once(
    smoke,
    "          && nebula.postProcessing === false\n          && metrics",
    "          && nebula.postProcessing === false\n          && gravity\n          && gravity.visualSystems.length === expectedGravitySystems.length\n          && expectedGravitySystems.every((id) => gravity.visualSystems.includes(id))\n          && gravity.objectCount === expectedGravityObjectCount\n          && gravity.blackHoleCount === expectedBlackHoleCount\n          && gravity.accretionDiscCount === expectedAccretionDiscCount\n          && gravity.wormholeCount === expectedWormholeCount\n          && gravity.wormholeMouthCount === expectedWormholeMouthCount\n          && gravity.animationMode === 'material-tsl'\n          && gravity.cpuVertexUpdates === false\n          && gravity.postProcessing === false\n          && gravity.screenSpaceDistortion === false\n          && metrics",
)
replace_once(
    smoke,
    "      EXPECTED_NEBULA_SYSTEMS,\n      EXPECTED_NEBULA_SHELL_COUNT\n    )",
    "      EXPECTED_NEBULA_SYSTEMS,\n      EXPECTED_NEBULA_SHELL_COUNT,\n      EXPECTED_GRAVITY_SYSTEMS,\n      EXPECTED_GRAVITY_OBJECT_COUNT,\n      EXPECTED_BLACK_HOLE_COUNT,\n      EXPECTED_ACCRETION_DISC_COUNT,\n      EXPECTED_WORMHOLE_COUNT,\n      EXPECTED_WORMHOLE_MOUTH_COUNT\n    )",
)

gravity_assertion = r'''
async function assertGravityDiagnostics(page) {
  const gravity = await page.evaluate(() => window.__SOLAR_WEBGPU_LAB_GRAVITY__)
  if (!gravity) throw new Error('W5b TSL gravity diagnostics were not published')

  const missingSystems = EXPECTED_GRAVITY_SYSTEMS.filter(
    (id) => !gravity.visualSystems.includes(id)
  )
  const unexpectedSystems = gravity.visualSystems.filter(
    (id) => !EXPECTED_GRAVITY_SYSTEMS.includes(id)
  )

  if (missingSystems.length || unexpectedSystems.length) {
    throw new Error(
      `Unexpected W5b gravity systems: ${JSON.stringify({ missingSystems, unexpectedSystems })}`
    )
  }
  if (gravity.objectCount !== EXPECTED_GRAVITY_OBJECT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_GRAVITY_OBJECT_COUNT} gravity objects, received ${gravity.objectCount}`
    )
  }
  if (gravity.blackHoleCount !== EXPECTED_BLACK_HOLE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_BLACK_HOLE_COUNT} black hole, received ${gravity.blackHoleCount}`
    )
  }
  if (gravity.accretionDiscCount !== EXPECTED_ACCRETION_DISC_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_ACCRETION_DISC_COUNT} accretion discs, received ${gravity.accretionDiscCount}`
    )
  }
  if (gravity.wormholeCount !== EXPECTED_WORMHOLE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_WORMHOLE_COUNT} wormhole, received ${gravity.wormholeCount}`
    )
  }
  if (gravity.wormholeMouthCount !== EXPECTED_WORMHOLE_MOUTH_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_WORMHOLE_MOUTH_COUNT} wormhole mouths, received ${gravity.wormholeMouthCount}`
    )
  }
  if (
    gravity.animationMode !== 'material-tsl'
    || gravity.cpuVertexUpdates !== false
    || gravity.postProcessing !== false
    || gravity.screenSpaceDistortion !== false
  ) {
    throw new Error(`W5b gravity contract failed: ${JSON.stringify(gravity)}`)
  }

  return gravity
}

'''
text = read(smoke)
if "async function assertGravityDiagnostics(page)" not in text:
    marker = "function assertDiagnostics(diagnostics, requested, actual) {"
    if marker not in text:
        raise SystemExit("Could not insert W5b gravity assertion")
    text = text.replace(marker, gravity_assertion + marker, 1)
    write(smoke, text)

text = read(smoke)
text = text.replace(
    "  const nebula = await assertNebulaDiagnostics(page)\n",
    "  const nebula = await assertNebulaDiagnostics(page)\n  const gravity = await assertGravityDiagnostics(page)\n",
)
text = text.replace(
    "  await assertNebulaDiagnostics(page)\n  assertDiagnostics(forcedDiagnostics",
    "  await assertNebulaDiagnostics(page)\n  await assertGravityDiagnostics(page)\n  assertDiagnostics(forcedDiagnostics",
)
text = text.replace(
    "  const restoredNebula = await assertNebulaDiagnostics(page)\n",
    "  const restoredNebula = await assertNebulaDiagnostics(page)\n  const restoredGravity = await assertGravityDiagnostics(page)\n",
)
text = text.replace(
    "    || !text.includes('Nebula TSL')\n",
    "    || !text.includes('Nebula TSL')\n    || !text.includes('Gravity TSL')\n",
    1,
)
text = text.replace(
    "{ diagnostics, effects, sun, nebula })",
    "{ diagnostics, effects, sun, nebula, gravity })",
)
text = text.replace(
    "{ diagnostics: restoredDiagnostics, effects: restoredEffects, sun: restoredSun, nebula: restoredNebula })",
    "{ diagnostics: restoredDiagnostics, effects: restoredEffects, sun: restoredSun, nebula: restoredNebula, gravity: restoredGravity })",
)
text = text.replace("W5a", "W5b")
write(smoke, text)

old_status = Path("src/components/solar-system/webgpu/LabW5aStatus.tsx")
new_status = Path("src/components/solar-system/webgpu/LabW5bStatus.tsx")
new_status.write_text('''\'use client\'

import {
  LAB_BLACK_HOLE_COUNT,
  LAB_GRAVITY_OBJECT_COUNT,
  LAB_WORMHOLE_COUNT,
  LAB_WORMHOLE_MOUTH_COUNT,
} from './LabGravitationalObjects'
import { LAB_NEBULA_SHELL_COUNT } from './LabNebulaHaze'

export default function LabW5bStatus() {
  return (
    <aside className="pointer-events-none fixed bottom-3 right-3 z-30 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-violet-200/10 bg-[#04070d]/86 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-violet-100/45">
            W5b parity scope
          </p>
          <h2 className="mt-1 text-[11px] font-semibold text-white/80">
            TSL gravitational presentation
          </h2>
        </div>
        <span className="rounded-full border border-violet-200/10 bg-violet-200/[0.06] px-2 py-1 font-mono text-[8px] font-semibold text-violet-100/65">
          Material TSL · Gravity TSL
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5 font-mono text-[8px] text-white/38">
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">objects</span>
          <span className="mt-0.5 block text-white/65">{LAB_GRAVITY_OBJECT_COUNT}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">black hole</span>
          <span className="mt-0.5 block text-white/65">{LAB_BLACK_HOLE_COUNT}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">wormhole</span>
          <span className="mt-0.5 block text-white/65">{LAB_WORMHOLE_COUNT}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">mouths</span>
          <span className="mt-0.5 block text-white/65">{LAB_WORMHOLE_MOUTH_COUNT}</span>
        </div>
      </div>

      <p className="mt-3 text-[8px] leading-relaxed text-white/32">
        The {LAB_NEBULA_SHELL_COUNT}-shell W5a haze now shares the parity scene with a node-material black hole and wormhole. No screen-space distortion or post-processing is active.
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
    "import LabW5aStatus from '../../../components/solar-system/webgpu/LabW5aStatus'",
    "import LabW5bStatus from '../../../components/solar-system/webgpu/LabW5bStatus'",
)
page_text = page_text.replace("<LabW5aStatus />", "<LabW5bStatus />")
write(page, page_text)

Path(__file__).unlink()
