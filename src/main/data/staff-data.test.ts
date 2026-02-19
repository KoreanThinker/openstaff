import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, lstatSync, mkdirSync, writeFileSync } from 'fs'
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
  createClaudeSettings
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
})
