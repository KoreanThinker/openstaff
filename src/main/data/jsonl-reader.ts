import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export function readJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) return []
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as T
      } catch {
        return null
      }
    })
    .filter((entry): entry is T => entry !== null)
}

export function appendJsonl<T>(filePath: string, entry: T): void {
  try {
    const dir = dirname(filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(filePath, JSON.stringify(entry) + '\n')
  } catch (err) {
    console.warn('appendJsonl failed:', filePath, err)
  }
}

export function writeJsonl<T>(filePath: string, entries: T[]): void {
  writeFileSync(filePath, entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''))
}

export function countJsonlLines(filePath: string): number {
  if (!existsSync(filePath)) return 0
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) return 0
  return content.split('\n').filter((line) => line.trim()).length
}
