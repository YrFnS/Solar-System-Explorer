import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const solarRoot = path.join(root, 'src', 'components', 'solar-system')
const uiRoot = path.join(solarRoot, 'ui')

const paths = {
  packageJson: path.join(root, 'package.json'),
  layout: path.join(root, 'src', 'app', 'layout.tsx'),
  sceneContainer: path.join(solarRoot, 'SceneContainer.tsx'),
  overlay: path.join(solarRoot, 'UIOverlayV4.tsx'),
  coordinator: path.join(uiRoot, 'MobileSurfaceCoordinator.tsx'),
  navigator: path.join(uiRoot, 'NavigatorBar.tsx'),
  inspector: path.join(uiRoot, 'BodyInspector.tsx'),
  tour: path.join(uiRoot, 'TourOverlayV4.tsx'),
  mission: path.join(solarRoot, 'ExperienceDock.tsx'),
  smoke: path.join(root, 'scripts', 'smoke-mobile-overlay.mjs'),
}

const entries = await Promise.all(
  Object.entries(paths).map(async ([key, filePath]) => [key, await readFile(filePath, 'utf8')])
)
const source = Object.fromEntries(
  entries.map(([key, value]) => [key, value.replace(/\r\n/g, '\n')])
)
let packageJson
try {
  packageJson = JSON.parse(source.packageJson)
} catch (error) {
  throw new Error(`Invalid package.json at ${paths.packageJson}`, { cause: error })
}
const failures = []

function requireContract(condition, message) {
  if (!condition) failures.push(message)
}

requireContract(
  packageJson.scripts?.['mobile:smoke']
    === 'node scripts/validate-mobile-overlay-contract.mjs && node scripts/smoke-mobile-overlay.mjs',
  'mobile:smoke must run both the static composition contract and browser gate.'
)
requireContract(
  packageJson.scripts?.['ui:smoke']?.includes('bun run mobile:smoke'),
  'ui:smoke must include the dedicated mobile overlay gate.'
)
requireContract(
  source.layout.includes('viewportFit: "cover"')
    && source.layout.includes('export const viewport'),
  'The Next.js viewport contract must enable viewport-fit=cover for device safe areas.'
)
requireContract(
  source.overlay.includes('MobileSurfaceCoordinator')
    && source.overlay.includes('missionControlOpen')
    && source.overlay.includes('blockedByModal={modalOpen}'),
  'UIOverlayV4 must own mission-control state and route bottom surfaces through one coordinator.'
)
requireContract(
  !source.sceneContainer.includes("import ExperienceDock")
    && !source.sceneContainer.includes('<ExperienceDock'),
  'SceneContainer must not render an independent mission-control surface outside the coordinator.'
)
requireContract(
  source.coordinator.includes("missionControlOpen\n      ? 'mission-control'")
    && source.coordinator.includes("tourActive\n        ? 'tour'")
    && source.coordinator.includes("selectedBody\n          ? 'inspector'")
    && source.coordinator.includes("'navigator'")
    && source.coordinator.includes('__SOLAR_MOBILE_OVERLAY__'),
  'The coordinator must retain the mission → tour → inspector → navigator priority and diagnostics.'
)
requireContract(
  source.coordinator.includes('expectedVisibleSurfaces')
    && source.coordinator.includes('.solar-mobile-sheet button')
    && source.coordinator.includes('min-height: 44px')
    && source.coordinator.includes('solar-mobile-safe-bottom'),
  'The coordinator must protect single-surface diagnostics, readable text, 44px controls, and safe-area placement.'
)

for (const [label, key, id] of [
  ['navigator', 'navigator', 'navigator'],
  ['inspector', 'inspector', 'inspector'],
  ['tour', 'tour', 'tour'],
  ['mission control', 'mission', 'mission-control'],
]) {
  requireContract(
    source[key].includes(`data-mobile-bottom-surface="${id}"`)
      && source[key].includes('data-mobile-surface-active'),
    `${label} must expose the coordinated mobile-surface contract.`
  )
}

requireContract(
  source.navigator.includes('Open mission control')
    && source.navigator.includes('min-w-11')
    && source.navigator.includes('solar-mobile-safe-bottom'),
  'The mobile navigator must include a 44px mission-control entry and safe-area placement.'
)
requireContract(
  source.inspector.includes('onOpenMissionControl')
    && source.inspector.includes('max-sm:hidden')
    && source.inspector.includes('min-h-11')
    && source.inspector.includes('solar-mobile-sheet'),
  'The body inspector must be a coordinated, touch-sized mobile sheet.'
)
requireContract(
  source.mission.includes('open: boolean')
    && source.mission.includes('onOpenChange: (open: boolean) => void')
    && source.mission.includes('hidden items-center')
    && source.mission.includes('solar-mobile-sheet'),
  'Mission control must be controlled by the coordinator and hide its standalone trigger on phones.'
)
requireContract(
  source.smoke.includes("assertSingleSurface(page, 'navigator')")
    && source.smoke.includes("assertSingleSurface(page, 'inspector')")
    && source.smoke.includes("assertSingleSurface(page, 'mission-control')")
    && source.smoke.includes("assertSingleSurface(page, 'tour')")
    && source.smoke.includes('undersizedControls')
    && source.smoke.includes('tinyText')
    && source.smoke.includes("orientation !== 'landscape'"),
  'The browser gate must cover every mobile surface, touch sizing, typography, and landscape rotation.'
)

if (failures.length > 0) {
  console.error('[mobile-overlay-contract] failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log('[mobile-overlay-contract] single-surface priority, safe areas, touch targets, and browser coverage passed')
}
