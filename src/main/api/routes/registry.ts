import { Router } from 'express'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { ApiContext } from '../server'
import type { RegistryIndex } from '@shared/types'
import { REGISTRY_DIR, REGISTRY_GITHUB_OWNER, REGISTRY_GITHUB_REPO, REGISTRY_CACHE_TTL_MS, SKILLS_DIR } from '@shared/constants'

const CACHE_FILE = join(REGISTRY_DIR, 'cache.json')

interface CachedRegistry {
  fetched_at: number
  data: RegistryIndex
}

async function fetchRegistryIndex(): Promise<RegistryIndex> {
  // Check cache first
  mkdirSync(REGISTRY_DIR, { recursive: true })
  if (existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as CachedRegistry
      if (Date.now() - cached.fetched_at < REGISTRY_CACHE_TTL_MS) {
        return cached.data
      }
    } catch { /* ignore corrupt cache */ }
  }

  const url = `https://raw.githubusercontent.com/${REGISTRY_GITHUB_OWNER}/${REGISTRY_GITHUB_REPO}/main/registry/index.json`
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) {
    // Return cached data if available, otherwise empty
    if (existsSync(CACHE_FILE)) {
      try {
        const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as CachedRegistry
        return cached.data
      } catch { /* ignore corrupt cache */ }
    }
    return { version: '1.0.0', updated_at: new Date().toISOString(), templates: [], skills: [] }
  }

  const data = await response.json() as RegistryIndex

  // Save to cache
  const cache: CachedRegistry = { fetched_at: Date.now(), data }
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))

  return data
}

export function registryRoutes(_ctx: ApiContext): Router {
  const router = Router()

  // Get registry index
  router.get('/', async (_req, res) => {
    try {
      const index = await fetchRegistryIndex()
      res.json(index)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get templates
  router.get('/templates', async (_req, res) => {
    try {
      const index = await fetchRegistryIndex()
      res.json(index.templates)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get skills
  router.get('/skills', async (_req, res) => {
    try {
      const index = await fetchRegistryIndex()
      res.json(index.skills)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Download/install a skill from registry
  router.post('/skills/:name/install', async (req, res) => {
    try {
      const index = await fetchRegistryIndex()
      const skill = index.skills.find((s) => s.name === req.params.name)
      if (!skill) return res.status(404).json({ error: 'Skill not found in registry' })

      // Validate skill name to prevent path traversal
      if (skill.name.includes('/') || skill.name.includes('\\') || skill.name.includes('..')) {
        return res.status(400).json({ error: 'Invalid skill name' })
      }

      const skillDir = join(SKILLS_DIR, skill.name)
      mkdirSync(skillDir, { recursive: true })

      // Fetch SKILL.md from GitHub
      const url = `https://raw.githubusercontent.com/${REGISTRY_GITHUB_OWNER}/${REGISTRY_GITHUB_REPO}/main/${skill.github_path}/SKILL.md`
      const response = await fetch(url)
      if (!response.ok) {
        return res.status(502).json({ error: 'Failed to download skill from registry' })
      }

      const content = await response.text()
      writeFileSync(join(skillDir, 'SKILL.md'), content)

      res.json({ status: 'installed', name: skill.name })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  return router
}
