import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { StaffConfig, StaffState } from '@shared/types'

// Override OPENSTAFF_HOME before importing
let tempDir: string

vi.mock('@shared/constants', async () => {
  const actual = await vi.importActual('@shared/constants')
  return {
    ...actual,
    get STAFFS_DIR() { return join(tempDir, 'staffs') },
    get SKILLS_DIR() { return join(tempDir, 'skills') },
    get OPENSTAFF_HOME() { return tempDir }
  }
})

// Import after mock
const {
  getStaffsDir,
  getStaffDir,
  ensureStaffDir,
  listStaffIds,
  readStaffConfig,
  writeStaffConfig,
  readStaffState,
  writeStaffState,
  deleteStaffDir,
  ensureMemoryMd,
  readMemoryMd,
  symlinkSkills,
  createClaudeSettings,
  createStaffMcpConfig
} = await import('./staff-data')

describe('staff-data', () => {
  const testConfig: StaffConfig = {
    id: 'test-staff-1',
    name: 'Test Staff',
    role: 'Tester',
    gather: 'Gather data',
    execute: 'Execute tasks',
    evaluate: 'Evaluate results',
    kpi: 'KPI target',
    agent: 'claude-code',
    model: 'claude-sonnet-4-5',
    skills: [],
    created_at: '2026-01-01T00:00:00Z'
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'openstaff-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('getStaffsDir / getStaffDir', () => {
    it('returns the staffs directory', () => {
      expect(getStaffsDir()).toBe(join(tempDir, 'staffs'))
    })

    it('returns staff directory path', () => {
      expect(getStaffDir('my-staff')).toBe(join(tempDir, 'staffs', 'my-staff'))
    })
  })

  describe('ensureStaffDir', () => {
    it('creates staff directory with .claude/skills', () => {
      const dir = ensureStaffDir('test-staff')
      expect(existsSync(dir)).toBe(true)
      expect(existsSync(join(dir, '.claude', 'skills'))).toBe(true)
    })
  })

  describe('listStaffIds', () => {
    it('returns empty array when no staffs exist', () => {
      expect(listStaffIds()).toEqual([])
    })

    it('lists staff directories', () => {
      ensureStaffDir('staff-a')
      ensureStaffDir('staff-b')
      const ids = listStaffIds()
      expect(ids).toContain('staff-a')
      expect(ids).toContain('staff-b')
    })
  })

  describe('writeStaffConfig / readStaffConfig', () => {
    it('writes and reads staff config', () => {
      writeStaffConfig(testConfig)
      const read = readStaffConfig('test-staff-1')
      expect(read).toEqual(testConfig)
    })

    it('generates CLAUDE.md alongside staff.json', () => {
      writeStaffConfig(testConfig)
      const dir = ensureStaffDir('test-staff-1')
      const claudeMd = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8')
      expect(claudeMd).toContain('Test Staff')
      expect(claudeMd).toContain('Gather data')
    })

    it('returns null for non-existent staff', () => {
      expect(readStaffConfig('nonexistent')).toBeNull()
    })
  })

  describe('writeStaffState / readStaffState', () => {
    it('writes and reads state', () => {
      const state: StaffState = {
        session_id: 'abc-123',
        last_started_at: '2026-01-01T00:00:00Z'
      }
      writeStaffState('test-staff-1', state)
      const read = readStaffState('test-staff-1')
      expect(read).toEqual(state)
    })

    it('returns default state for non-existent', () => {
      const state = readStaffState('nonexistent')
      expect(state.session_id).toBeNull()
      expect(state.last_started_at).toBeNull()
    })
  })

  describe('deleteStaffDir', () => {
    it('deletes staff directory', () => {
      const dir = ensureStaffDir('to-delete')
      expect(existsSync(dir)).toBe(true)
      deleteStaffDir('to-delete')
      expect(existsSync(dir)).toBe(false)
    })

    it('handles non-existent directory gracefully', () => {
      expect(() => deleteStaffDir('nonexistent')).not.toThrow()
    })
  })

  describe('ensureMemoryMd / readMemoryMd', () => {
    it('creates empty memory.md', () => {
      ensureStaffDir('test-staff-1')
      ensureMemoryMd('test-staff-1')
      const content = readMemoryMd('test-staff-1')
      expect(content).toBe('')
    })

    it('returns empty string for non-existent', () => {
      expect(readMemoryMd('nonexistent')).toBe('')
    })
  })

  describe('symlinkSkills', () => {
    it('creates symlinks to skills', () => {
      // Create a skill in skills dir
      const skillsDir = join(tempDir, 'skills', 'test-skill')
      mkdirSync(skillsDir, { recursive: true })
      writeFileSync(join(skillsDir, 'SKILL.md'), '---\nname: test-skill\n---')

      // Create staff and symlink
      ensureStaffDir('staff-with-skills')
      symlinkSkills('staff-with-skills', ['test-skill'])

      const staffSkillsDir = join(tempDir, 'staffs', 'staff-with-skills', '.claude', 'skills')
      const symlinkPath = join(staffSkillsDir, 'test-skill')
      expect(existsSync(symlinkPath)).toBe(true)
    })

    it('handles non-existent skill gracefully', () => {
      ensureStaffDir('staff-no-skill')
      expect(() => symlinkSkills('staff-no-skill', ['nonexistent'])).not.toThrow()
    })

    it('replaces existing symlinks when called again', () => {
      // Create two skills
      const skill1Dir = join(tempDir, 'skills', 'skill-1')
      const skill2Dir = join(tempDir, 'skills', 'skill-2')
      mkdirSync(skill1Dir, { recursive: true })
      mkdirSync(skill2Dir, { recursive: true })
      writeFileSync(join(skill1Dir, 'SKILL.md'), '---\nname: skill-1\n---')
      writeFileSync(join(skill2Dir, 'SKILL.md'), '---\nname: skill-2\n---')

      ensureStaffDir('staff-replace')
      // First symlink skill-1
      symlinkSkills('staff-replace', ['skill-1'])
      const staffSkillsDir = join(tempDir, 'staffs', 'staff-replace', '.claude', 'skills')
      expect(existsSync(join(staffSkillsDir, 'skill-1'))).toBe(true)

      // Replace with skill-2
      symlinkSkills('staff-replace', ['skill-2'])
      expect(existsSync(join(staffSkillsDir, 'skill-1'))).toBe(false)
      expect(existsSync(join(staffSkillsDir, 'skill-2'))).toBe(true)
    })

    it('cleans up regular directories in skills folder', () => {
      ensureStaffDir('staff-dir-cleanup')
      const staffSkillsDir = join(tempDir, 'staffs', 'staff-dir-cleanup', '.claude', 'skills')
      mkdirSync(staffSkillsDir, { recursive: true })
      // Create a regular directory (not a symlink) in the skills folder
      mkdirSync(join(staffSkillsDir, 'stale-dir'), { recursive: true })
      writeFileSync(join(staffSkillsDir, 'stale-dir', 'file.txt'), 'data')

      // symlinkSkills should clean up the regular directory
      symlinkSkills('staff-dir-cleanup', [])
      expect(existsSync(join(staffSkillsDir, 'stale-dir'))).toBe(false)
    })
  })

  describe('createClaudeSettings', () => {
    it('creates .claude/settings.json', () => {
      ensureStaffDir('staff-settings')
      createClaudeSettings('staff-settings')
      const settingsPath = join(tempDir, 'staffs', 'staff-settings', '.claude', 'settings.json')
      expect(existsSync(settingsPath)).toBe(true)
      const content = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      expect(content.permissions).toBeDefined()
    })
  })

  describe('createStaffMcpConfig', () => {
    it('creates staff-mcp.json with empty mcpServers', () => {
      ensureStaffDir('staff-mcp')
      createStaffMcpConfig('staff-mcp')
      const mcpPath = join(tempDir, 'staffs', 'staff-mcp', 'staff-mcp.json')
      expect(existsSync(mcpPath)).toBe(true)
      const content = JSON.parse(readFileSync(mcpPath, 'utf-8'))
      expect(content.mcpServers).toEqual({})
    })
  })
})
