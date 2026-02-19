import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs'

export function readJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) return []
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T)
}

export function appendJsonl<T>(filePath: string, entry: T): void {
  appendFileSync(filePath, JSON.stringify(entry) + '\n')
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
