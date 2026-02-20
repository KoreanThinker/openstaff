import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, cpSync, rmSync, lstatSync } from 'fs'
import { join, resolve } from 'path'
import { SKILLS_DIR } from '@shared/constants'
import type { SkillInfo, SkillMdFrontmatter, SkillAuthStatus } from '@shared/types'
import { ConfigStore } from '../store/config-store'

export function getSkillsDir(): string {
  return SKILLS_DIR
}

export function ensureSkillsDir(): void {
  mkdirSync(SKILLS_DIR, { recursive: true })
}

export function listSkillNames(): string[] {
  ensureSkillsDir()
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

export function parseSkillMd(skillName: string): SkillMdFrontmatter | null {
  const skillMdPath = join(SKILLS_DIR, skillName, 'SKILL.md')
  if (!existsSync(skillMdPath)) return null

  const content = readFileSync(skillMdPath, 'utf-8')
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return null

  const yaml = frontmatterMatch[1]!
  const result: SkillMdFrontmatter = {
    name: skillName,
    description: ''
  }

  let inMetadata = false
  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const isIndented = line.startsWith('  ')
    if (isIndented && inMetadata) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (!result.metadata) result.metadata = {}
      if (key === 'author') result.metadata.author = value
      else if (key === 'version') result.metadata.version = value
      continue
    }

    inMetadata = false
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key === 'name') result.name = value
    else if (key === 'description') result.description = value
    else if (key === 'allowed-tools') result['allowed-tools'] = value
    else if (key === 'compatibility') result.compatibility = value
    else if (key === 'metadata') inMetadata = true
  }

  return result
}

export function extractRequiredEnvVars(compatibility: string | undefined): string[] {
  if (!compatibility) return []
  const envVarPattern = /[A-Z][A-Z0-9_]+(?:_KEY|_TOKEN|_SECRET|_PASSWORD|_API_KEY)/g
  return [...new Set(compatibility.match(envVarPattern) || [])]
}

export function getSkillAuthStatus(
  requiredVars: string[],
  configStore: ConfigStore
): SkillAuthStatus {
  if (requiredVars.length === 0) return 'not_configured'
  const allConfigured = requiredVars.every((v) => {
    const val = configStore.get(`skill_env_${v}` as never)
    return val && val !== ''
  })
  return allConfigured ? 'active' : 'needs_auth'
}

export function readSkillMdContent(skillName: string): string {
  const skillMdPath = join(SKILLS_DIR, skillName, 'SKILL.md')
  if (!existsSync(skillMdPath)) return ''
  const raw = readFileSync(skillMdPath, 'utf-8')
  // Extract markdown body after frontmatter
  const match = raw.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/)
  return match ? match[1]!.trim() : raw
}

export function getSkillInfo(skillName: string, configStore: ConfigStore, connectedStaffs: string[] = []): SkillInfo | null {
  const frontmatter = parseSkillMd(skillName)
  if (!frontmatter) return null

  const requiredVars = extractRequiredEnvVars(frontmatter.compatibility)
  const authStatus = getSkillAuthStatus(requiredVars, configStore)

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    content: readSkillMdContent(skillName),
    author: frontmatter.metadata?.author || 'unknown',
    version: frontmatter.metadata?.version || '1.0',
    allowed_tools: frontmatter['allowed-tools'] || '',
    compatibility: frontmatter.compatibility || '',
    auth_status: authStatus,
    required_env_vars: requiredVars,
    connected_staffs: connectedStaffs,
    source: 'local',
    installed_at: new Date().toISOString()
  }
}

export function importSkill(sourcePath: string): string {
  ensureSkillsDir()
  const resolvedSource = resolve(sourcePath)

  // Validate source is a real directory (not a symlink)
  const srcStat = lstatSync(resolvedSource)
  if (!srcStat.isDirectory()) {
    throw new Error('Source path must be a directory')
  }

  const skillMdPath = join(resolvedSource, 'SKILL.md')
  if (!existsSync(skillMdPath)) {
    throw new Error('Invalid skill directory: SKILL.md not found')
  }

  // Validate SKILL.md is a real file (not a symlink)
  const skillMdStat = lstatSync(skillMdPath)
  if (!skillMdStat.isFile()) {
    throw new Error('SKILL.md must be a regular file')
  }

  const content = readFileSync(skillMdPath, 'utf-8')
  const nameMatch = content.match(/name:\s*(.+)/)
  const skillName = nameMatch ? nameMatch[1]!.trim().replace(/["']/g, '') : ''
  if (!skillName) throw new Error('SKILL.md missing name field')

  // Validate skill name has no path traversal
  if (skillName.includes('/') || skillName.includes('\\') || skillName.includes('..')) {
    throw new Error('Invalid skill name: must not contain path separators')
  }

  const destPath = join(SKILLS_DIR, skillName)
  // Copy without following symlinks to prevent copying sensitive files
  cpSync(resolvedSource, destPath, { recursive: true, dereference: false })
  return skillName
}

export function deleteSkill(skillName: string): void {
  const path = join(SKILLS_DIR, skillName)
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
  }
}

const OPENSTAFF_SKILL_CONTENT = `---
name: openstaff
description: >
  OpenStaff platform integration. Use to report cycle completion,
  record KPI metrics, and request human help when stuck.
allowed-tools: Bash(echo *) Read
---

## cycle-complete
After completing a full Gather → Execute → Evaluate cycle,
append to ./cycles.jsonl:
\`{"cycle": N, "date": "YYYY-MM-DD", "summary": "one line summary"}\`

## record-kpi
After Evaluate, record KPI metrics.
Append to ./kpi.jsonl:
\`{"date": "YYYY-MM-DD", "cycle": N, "metrics": {"metric_name": value}}\`

## giveup
ONLY after exhausting ALL options (retry at least 3 times).
Append to ./signals.jsonl:
\`{"type": "giveup", "reason": "detailed reason", "timestamp": "ISO8601"}\`
This pauses your execution and alerts the user.
`

export function ensureBuiltinSkill(): void {
  const dir = join(SKILLS_DIR, 'openstaff')
  mkdirSync(dir, { recursive: true })
  const skillPath = join(dir, 'SKILL.md')
  if (!existsSync(skillPath)) {
    writeFileSync(skillPath, OPENSTAFF_SKILL_CONTENT)
  }
}
