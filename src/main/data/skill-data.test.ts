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
  deleteSkill
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
})
