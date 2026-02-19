import { Router } from 'express'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { ApiContext } from '../server'
import type { RegistryIndex } from '@shared/types'
import { REGISTRY_DIR, REGISTRY_GITHUB_OWNER, REGISTRY_GITHUB_REPO, REGISTRY_CACHE_TTL_MS } from '@shared/constants'

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
  const response = await fetch(url)
  if (!response.ok) {
    // Return cached data if available, otherwise empty
    if (existsSync(CACHE_FILE)) {
      const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as CachedRegistry
      return cached.data
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

  return router
}
