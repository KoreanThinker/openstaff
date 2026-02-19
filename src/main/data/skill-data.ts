import { readFileSync, existsSync, mkdirSync, readdirSync, cpSync, rmSync } from 'fs'
import { join } from 'path'
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
  if (!existsSync(SKILLS_DIR)) return []
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

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key === 'name') result.name = value
    else if (key === 'description') result.description = value
    else if (key === 'allowed-tools') result['allowed-tools'] = value
    else if (key === 'compatibility') result.compatibility = value
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

export function getSkillInfo(skillName: string, configStore: ConfigStore, connectedStaffs: string[] = []): SkillInfo | null {
  const frontmatter = parseSkillMd(skillName)
  if (!frontmatter) return null

  const requiredVars = extractRequiredEnvVars(frontmatter.compatibility)
  const authStatus = getSkillAuthStatus(requiredVars, configStore)

  return {
    name: frontmatter.name,
    description: frontmatter.description,
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
  const skillMdPath = join(sourcePath, 'SKILL.md')
  if (!existsSync(skillMdPath)) {
    throw new Error('Invalid skill directory: SKILL.md not found')
  }

  const content = readFileSync(skillMdPath, 'utf-8')
  const nameMatch = content.match(/name:\s*(.+)/)
  const skillName = nameMatch ? nameMatch[1]!.trim().replace(/["']/g, '') : ''
  if (!skillName) throw new Error('SKILL.md missing name field')

  const destPath = join(SKILLS_DIR, skillName)
  cpSync(sourcePath, destPath, { recursive: true })
  return skillName
}

export function deleteSkill(skillName: string): void {
  const path = join(SKILLS_DIR, skillName)
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
  }
}
