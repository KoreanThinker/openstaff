import { readFileSync } from 'fs'

function isValidBytes(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

export function parseMemAvailableBytes(meminfo: string): number | null {
  const match = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB$/m)
  if (!match) return null

  const availableKb = Number(match[1])
  if (!Number.isFinite(availableKb) || availableKb < 0) return null
  return availableKb * 1024
}

export function readLinuxMemAvailableBytes(meminfoPath = '/proc/meminfo'): number | null {
  try {
    const content = readFileSync(meminfoPath, 'utf-8')
    return parseMemAvailableBytes(content)
  } catch {
    return null
  }
}

export function calculateMemoryMetrics(
  totalMemBytes: number,
  freeMemBytes: number,
  availableMemBytes: number | null
): {
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
} {
  if (!isValidBytes(totalMemBytes) || totalMemBytes <= 0) {
    return {
      memory_percent: 0,
      memory_used_mb: 0,
      memory_total_mb: 0
    }
  }

  const fallbackAvailable = isValidBytes(freeMemBytes) ? freeMemBytes : 0
  const preferredAvailable = isValidBytes(availableMemBytes ?? Number.NaN)
    ? (availableMemBytes as number)
    : fallbackAvailable

  const boundedAvailable = Math.min(totalMemBytes, Math.max(0, preferredAvailable))
  const usedMemBytes = totalMemBytes - boundedAvailable

  return {
    memory_percent: Math.min(100, Math.round((usedMemBytes / totalMemBytes) * 1000) / 10),
    memory_used_mb: Math.round(usedMemBytes / (1024 * 1024)),
    memory_total_mb: Math.round(totalMemBytes / (1024 * 1024))
  }
}
