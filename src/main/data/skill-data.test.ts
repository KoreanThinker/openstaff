import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let tempDir: string

vi.mock('@shared/constants', async () => {
  const actual = await vi.importActual('@shared/constants')
  return {
    ...actual,
    get SKILLS_DIR() { return join(tempDir, 'skills') },
    get STAFFS_DIR() { return join(tempDir, 'staffs') },
    get OPENSTAFF_HOME() { return tempDir }
  }
})

const {
  listSkillNames,
  parseSkillMd,
  extractRequiredEnvVars,
  importSkill,
  deleteSkill,
  ensureBuiltinSkill,
  getSkillsDir,
  getSkillAuthStatus,
  getSkillInfo
} = await import('./skill-data')

describe('skill-data', () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'openstaff-skill-test-'))
    mkdirSync(join(tempDir, 'skills'), { recursive: true })
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function createSkill(name: string, skillMdContent: string): void {
    const dir = join(tempDir, 'skills', name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), skillMdContent)
  }

  describe('getSkillsDir', () => {
    it('returns the skills directory path', () => {
      const dir = getSkillsDir()
      expect(dir).toContain('skills')
    })
  })

  describe('listSkillNames', () => {
    it('returns empty array when no skills installed', () => {
      expect(listSkillNames()).toEqual([])
    })

    it('lists installed skill directories', () => {
      createSkill('skill-a', '---\nname: skill-a\n---')
      createSkill('skill-b', '---\nname: skill-b\n---')
      const names = listSkillNames()
      expect(names).toContain('skill-a')
      expect(names).toContain('skill-b')
    })
  })

  describe('parseSkillMd', () => {
    it('parses SKILL.md frontmatter', () => {
      createSkill('test-skill', `---
name: test-skill
description: A test skill
allowed-tools: Bash(python *) Read
compatibility: Requires API_KEY environment variable
---

# Instructions
Use this skill for testing.`)

      const result = parseSkillMd('test-skill')
      expect(result).not.toBeNull()
      expect(result!.name).toBe('test-skill')
      expect(result!.description).toBe('A test skill')
      expect(result!['allowed-tools']).toBe('Bash(python *) Read')
      expect(result!.compatibility).toBe('Requires API_KEY environment variable')
    })

    it('returns null for non-existent skill', () => {
      expect(parseSkillMd('nonexistent')).toBeNull()
    })

    it('returns null for SKILL.md without frontmatter', () => {
      createSkill('no-frontmatter', '# Just markdown')
      expect(parseSkillMd('no-frontmatter')).toBeNull()
    })

    it('skips frontmatter lines without a colon', () => {
      createSkill('colon-skip', `---
name: colon-skill
this line has no colon
description: good desc
---
# Content`)
      const result = parseSkillMd('colon-skip')
      expect(result).not.toBeNull()
      expect(result!.name).toBe('colon-skill')
      expect(result!.description).toBe('good desc')
    })
  })

  describe('getSkillAuthStatus', () => {
    it('returns not_configured when no required vars', () => {
      const mockStore = { get: () => '' } as never
      expect(getSkillAuthStatus([], mockStore)).toBe('not_configured')
    })

    it('returns active when all vars are configured', () => {
      const mockStore = { get: () => 'some-value' } as never
      expect(getSkillAuthStatus(['MY_API_KEY'], mockStore)).toBe('active')
    })

    it('returns needs_auth when vars are not configured', () => {
      const mockStore = { get: () => '' } as never
      expect(getSkillAuthStatus(['MY_API_KEY'], mockStore)).toBe('needs_auth')
    })
  })

  describe('getSkillInfo', () => {
    it('returns skill info with defaults for missing metadata', () => {
      createSkill('info-skill', `---
name: info-skill
description: Info skill description
---
# Content`)
      const mockStore = { get: () => '' } as never
      const info = getSkillInfo('info-skill', mockStore)
      expect(info).not.toBeNull()
      expect(info!.author).toBe('unknown')
      expect(info!.version).toBe('1.0')
      expect(info!.content).toBe('# Content')
      expect(info!.source).toBe('local')
    })

    it('returns null for nonexistent skill', () => {
      const mockStore = { get: () => '' } as never
      expect(getSkillInfo('nonexistent', mockStore)).toBeNull()
    })
  })

  describe('extractRequiredEnvVars', () => {
    it('extracts env var patterns from compatibility string', () => {
      const vars = extractRequiredEnvVars('Requires INSTAGRAM_API_KEY and META_ADS_TOKEN')
      expect(vars).toContain('INSTAGRAM_API_KEY')
      expect(vars).toContain('META_ADS_TOKEN')
    })

    it('returns empty array for undefined', () => {
      expect(extractRequiredEnvVars(undefined)).toEqual([])
    })

    it('returns empty array when no env vars found', () => {
      expect(extractRequiredEnvVars('No special requirements')).toEqual([])
    })

    it('deduplicates results', () => {
      const vars = extractRequiredEnvVars('Use API_KEY here and API_KEY there')
      expect(vars).toEqual(['API_KEY'])
    })
  })

  describe('importSkill', () => {
    it('copies skill directory to skills dir', () => {
      const sourceDir = join(tempDir, 'source-skill')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '---\nname: imported-skill\ndescription: test\n---')

      const name = importSkill(sourceDir)
      expect(name).toBe('imported-skill')
      expect(existsSync(join(tempDir, 'skills', 'imported-skill', 'SKILL.md'))).toBe(true)
    })

    it('throws for directory without SKILL.md', () => {
      const sourceDir = join(tempDir, 'no-skill')
      mkdirSync(sourceDir, { recursive: true })
      expect(() => importSkill(sourceDir)).toThrow('SKILL.md not found')
    })

    it('throws for SKILL.md without name field', () => {
      const sourceDir = join(tempDir, 'no-name-skill')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Just markdown with no frontmatter name')
      expect(() => importSkill(sourceDir)).toThrow('SKILL.md missing name field')
    })
  })

  describe('deleteSkill', () => {
    it('deletes skill directory', () => {
      createSkill('to-delete', '---\nname: to-delete\n---')
      expect(existsSync(join(tempDir, 'skills', 'to-delete'))).toBe(true)
      deleteSkill('to-delete')
      expect(existsSync(join(tempDir, 'skills', 'to-delete'))).toBe(false)
    })

    it('handles non-existent skill gracefully', () => {
      expect(() => deleteSkill('nonexistent')).not.toThrow()
    })
  })

  describe('ensureBuiltinSkill', () => {
    it('creates openstaff skill if not exists', () => {
      ensureBuiltinSkill()
      const skillPath = join(tempDir, 'skills', 'openstaff', 'SKILL.md')
      expect(existsSync(skillPath)).toBe(true)
      const { readFileSync } = require('fs')
      const content = readFileSync(skillPath, 'utf-8')
      expect(content).toContain('name: openstaff')
      expect(content).toContain('cycle-complete')
      expect(content).toContain('record-kpi')
      expect(content).toContain('giveup')
    })

    it('does not overwrite existing openstaff skill', () => {
      createSkill('openstaff', '---\nname: openstaff\n---\ncustom content')
      ensureBuiltinSkill()
      const { readFileSync } = require('fs')
      const content = readFileSync(join(tempDir, 'skills', 'openstaff', 'SKILL.md'), 'utf-8')
      expect(content).toContain('custom content')
    })
  })
})
