import type {
  EffectiveQuality,
  FramePacingMode,
  RendererPowerPreference,
} from './performance-store'

export interface FramePacingProfile {
  activeFps: number
  idleFps: number
  staticFps: number
  powerPreference: RendererPowerPreference
}

export const FRAME_PACING_PROFILES: Record<EffectiveQuality, FramePacingProfile> = {
  eco: {
    activeFps: 30,
    idleFps: 24,
    staticFps: 2,
    powerPreference: 'low-power',
  },
  balanced: {
    activeFps: 45,
    idleFps: 30,
    staticFps: 2,
    powerPreference: 'low-power',
  },
  ultra: {
    activeFps: 60,
    idleFps: 45,
    staticFps: 3,
    powerPreference: 'high-performance',
  },
}

const REDUCED_MOTION_CAPS: Record<FramePacingMode, number> = {
  active: 30,
  idle: 24,
  static: 1,
  suspended: 0,
}

export function getFramePacingTarget(
  quality: EffectiveQuality,
  mode: FramePacingMode,
  reducedMotion: boolean
) {
  if (mode === 'suspended') return 0

  const profile = FRAME_PACING_PROFILES[quality]
  const target = mode === 'active'
    ? profile.activeFps
    : mode === 'idle'
      ? profile.idleFps
      : profile.staticFps

  return reducedMotion
    ? Math.min(target, REDUCED_MOTION_CAPS[mode])
    : target
}

export function getRendererPowerPreference(
  quality: EffectiveQuality
): RendererPowerPreference {
  return FRAME_PACING_PROFILES[quality].powerPreference
}
