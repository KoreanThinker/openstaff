export type ResourceHealth = 'normal' | 'warning' | 'critical'

export function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}

export function getResourceHealth(percent: number): ResourceHealth {
  const safePercent = clampPercent(percent)
  if (safePercent >= 90) return 'critical'
  if (safePercent >= 75) return 'warning'
  return 'normal'
}

export function formatResourcePercent(percent: number): string {
  const safePercent = clampPercent(percent)
  if (safePercent >= 99 || safePercent < 10) return `${safePercent.toFixed(1)}%`
  return `${safePercent.toFixed(0)}%`
}
