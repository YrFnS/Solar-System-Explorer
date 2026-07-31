'use client'

import { create } from 'zustand'

interface LabPostState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  toggle: () => void
  reset: () => void
}

export const useLabPostStore = create<LabPostState>((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  reset: () => set({ enabled: false }),
}))
