'use client'

import { useEffect } from 'react'
import ExperienceDock from '../ExperienceDock'
import { useSolarSystemStore } from '../store'
import BodyInspector from './BodyInspector'
import NavigatorBar from './NavigatorBar'
import TourOverlayV4 from './TourOverlayV4'

export type MobileBottomSurface =
  | 'none'
  | 'navigator'
  | 'inspector'
  | 'tour'
  | 'mission-control'

export interface MobileOverlayDiagnostics {
  activeSurface: MobileBottomSurface
  expectedVisibleSurfaces: number
  missionControlOpen: boolean
  selectedBody: string | null
  tourActive: boolean
  blockedByModal: boolean
  mobileViewport: boolean
  viewportWidth: number
  viewportHeight: number
  orientation: 'portrait' | 'landscape'
  updatedAt: number
}

declare global {
  interface Window {
    __SOLAR_MOBILE_OVERLAY__?: MobileOverlayDiagnostics
  }
}

interface MobileSurfaceCoordinatorProps {
  blockedByModal: boolean
  missionControlOpen: boolean
  onMissionControlOpenChange: (open: boolean) => void
  onOpenSearch: () => void
}

const MOBILE_VIEWPORT_QUERY = '(max-width: 639px), (max-width: 899px) and (max-height: 639px)'

export default function MobileSurfaceCoordinator({
  blockedByModal,
  missionControlOpen,
  onMissionControlOpenChange,
  onOpenSearch,
}: MobileSurfaceCoordinatorProps) {
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const tourActive = useSolarSystemStore((state) => state.isTourMode)

  const activeSurface: MobileBottomSurface = blockedByModal
    ? 'none'
    : missionControlOpen
      ? 'mission-control'
      : tourActive
        ? 'tour'
        : selectedBody
          ? 'inspector'
          : 'navigator'

  useEffect(() => {
    if (blockedByModal && missionControlOpen) {
      onMissionControlOpenChange(false)
    }
  }, [blockedByModal, missionControlOpen, onMissionControlOpenChange])

  useEffect(() => {
    const publish = () => {
      const mobileViewport = window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
      window.__SOLAR_MOBILE_OVERLAY__ = {
        activeSurface,
        expectedVisibleSurfaces: mobileViewport && activeSurface !== 'none' ? 1 : 0,
        missionControlOpen,
        selectedBody,
        tourActive,
        blockedByModal,
        mobileViewport,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
        updatedAt: Date.now(),
      }
    }

    publish()
    window.addEventListener('resize', publish)
    window.addEventListener('orientationchange', publish)

    return () => {
      window.removeEventListener('resize', publish)
      window.removeEventListener('orientationchange', publish)
      delete window.__SOLAR_MOBILE_OVERLAY__
    }
  }, [
    activeSurface,
    blockedByModal,
    missionControlOpen,
    selectedBody,
    tourActive,
  ])

  const openMissionControl = () => onMissionControlOpenChange(true)

  return (
    <>
      <style>{`
        @media (max-width: 639px), (max-width: 899px) and (max-height: 639px) {
          [data-mobile-bottom-surface][data-mobile-surface-active="false"],
          [data-mission-control-trigger="desktop"] {
            display: none !important;
          }

          .solar-mobile-safe-bottom {
            bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem) !important;
          }

          .solar-mobile-safe-top {
            padding-top: calc(env(safe-area-inset-top, 0px) + 0.5rem);
          }

          .solar-mobile-sheet [class~="text-[7px]"] {
            font-size: 10px !important;
          }

          .solar-mobile-sheet [class~="text-[8px]"] {
            font-size: 11px !important;
          }

          .solar-mobile-sheet [class~="text-[9px]"],
          .solar-mobile-sheet [class~="text-[10px]"] {
            font-size: 12px !important;
          }

          .solar-mobile-sheet button,
          .solar-mobile-sheet input:not([type="checkbox"]),
          .solar-mobile-sheet label {
            min-height: 44px;
          }

          .solar-mobile-sheet .solar-mobile-icon-button {
            min-width: 44px;
          }
        }

        @media (min-width: 640px) and (max-width: 899px) and (max-height: 639px) {
          [data-mobile-bottom-surface="navigator"] {
            position: fixed !important;
            left: 50% !important;
            right: auto !important;
            top: auto !important;
            width: calc(100vw - 1rem) !important;
            transform: translateX(-50%) !important;
          }

          [data-mobile-bottom-surface="inspector"],
          [data-mobile-bottom-surface="tour"],
          [data-mobile-bottom-surface="mission-control"] {
            position: fixed !important;
            inset-inline: 0.5rem !important;
            top: auto !important;
            bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem) !important;
            width: auto !important;
            max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1rem) !important;
            transform: none !important;
          }
        }
      `}</style>

      <NavigatorBar
        mobileActive={activeSurface === 'navigator'}
        onOpenMissionControl={openMissionControl}
        onOpenSearch={onOpenSearch}
      />
      <BodyInspector
        mobileActive={activeSurface === 'inspector'}
        onOpenMissionControl={openMissionControl}
      />
      <TourOverlayV4 mobileActive={activeSurface === 'tour'} />
      <ExperienceDock
        mobileActive={activeSurface === 'mission-control'}
        open={missionControlOpen}
        onOpenChange={onMissionControlOpenChange}
      />
    </>
  )
}
