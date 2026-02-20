import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'fs'
import { join } from 'path'
import { STAFFS_DIR, SKILLS_DIR } from '@shared/constants'
import type { StaffConfig, StaffState } from '@shared/types'
import { generateClaudeMd } from './template-generator'

export function getStaffsDir(): string {
  return STAFFS_DIR
}

export function getStaffDir(staffId: string): string {
  if (staffId.includes('/') || staffId.includes('\\') || staffId.includes('..') || staffId !== staffId.trim()) {
    throw new Error(`Invalid staff ID: ${staffId}`)
  }
  return join(STAFFS_DIR, staffId)
}

export function ensureStaffDir(staffId: string): string {
  const dir = getStaffDir(staffId)
  mkdirSync(dir, { recursive: true })
  mkdirSync(join(dir, '.claude', 'skills'), { recursive: true })
  return dir
}

export function listStaffIds(): string[] {
  if (!existsSync(STAFFS_DIR)) return []
  return readdirSync(STAFFS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

export function readStaffConfig(staffId: string): StaffConfig | null {
  const path = join(getStaffDir(staffId), 'staff.json')
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as StaffConfig
}

export function writeStaffConfig(config: StaffConfig): void {
  const dir = ensureStaffDir(config.id)
  writeFileSync(join(dir, 'staff.json'), JSON.stringify(config, null, 2))
  const claudeMd = generateClaudeMd(config)
  writeFileSync(join(dir, 'CLAUDE.md'), claudeMd)
}

export function readStaffState(staffId: string): StaffState {
  const path = join(getStaffDir(staffId), 'state.json')
  if (!existsSync(path)) return { session_id: null, last_started_at: null }
  return JSON.parse(readFileSync(path, 'utf-8')) as StaffState
}

export function writeStaffState(staffId: string, state: StaffState): void {
  const dir = ensureStaffDir(staffId)
  writeFileSync(join(dir, 'state.json'), JSON.stringify(state, null, 2))
}

export function deleteStaffDir(staffId: string): void {
  const dir = getStaffDir(staffId)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function ensureMemoryMd(staffId: string): void {
  const path = join(getStaffDir(staffId), 'memory.md')
  if (!existsSync(path)) {
    writeFileSync(path, '')
  }
}

export function readMemoryMd(staffId: string): string {
  const path = join(getStaffDir(staffId), 'memory.md')
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf-8')
}

export function symlinkSkills(staffId: string, skillNames: string[]): void {
  const skillsDir = join(getStaffDir(staffId), '.claude', 'skills')
  mkdirSync(skillsDir, { recursive: true })

  // Remove existing symlinks
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.isDirectory()) {
        rmSync(join(skillsDir, entry.name), { recursive: true, force: true })
      }
    }
  }

  // Create new symlinks
  const { symlinkSync } = require('fs')
  for (const name of skillNames) {
    const src = join(SKILLS_DIR, name)
    const dest = join(skillsDir, name)
    if (existsSync(src)) {
      symlinkSync(src, dest, 'dir')
    }
  }
}

export function createClaudeSettings(staffId: string): void {
  const dir = join(getStaffDir(staffId), '.claude')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({
    permissions: {
      allow: ["Bash(*)", "Read", "Write", "Edit", "Glob", "Grep"],
      deny: []
    }
  }, null, 2))
}

export function createStaffMcpConfig(staffId: string): void {
  const staffDir = getStaffDir(staffId)
  writeFileSync(join(staffDir, 'staff-mcp.json'), JSON.stringify({
    mcpServers: {}
  }, null, 2))
}
