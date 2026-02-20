import { Router } from 'express'
import { resolve, join as pathJoin } from 'path'
import { existsSync } from 'fs'
import type { ApiContext } from '../server'
import { listSkillNames, getSkillInfo, importSkill, deleteSkill } from '../../data/skill-data'
import { listStaffIds, readStaffConfig, symlinkSkills, writeStaffConfig } from '../../data/staff-data'

export function skillRoutes(ctx: ApiContext): Router {
  const router = Router()

  // List all skills
  router.get('/', (_req, res) => {
    try {
      const names = listSkillNames()
      const skills = names.map((name) => {
        const connectedStaffs = listStaffIds().filter((id) => {
          const config = readStaffConfig(id)
          return config?.skills.includes(name)
        })
        return getSkillInfo(name, ctx.configStore, connectedStaffs)
      }).filter(Boolean)
      res.json(skills)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get single skill
  router.get('/:name', (req, res) => {
    try {
      const connectedStaffs = listStaffIds().filter((id) => {
        const config = readStaffConfig(id)
        return config?.skills.includes(req.params.name!)
      })
      const info = getSkillInfo(req.params.name!, ctx.configStore, connectedStaffs)
      if (!info) return res.status(404).json({ error: 'Skill not found' })
      res.json(info)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Import skill from local path
  router.post('/import', (req, res) => {
    try {
      const { path: skillPath } = req.body as { path: string }
      if (!skillPath || typeof skillPath !== 'string') {
        return res.status(400).json({ error: 'Invalid path' })
      }
      const resolvedPath = resolve(skillPath)
      if (!existsSync(resolvedPath)) {
        return res.status(400).json({ error: 'Path does not exist' })
      }
      // Must be a valid skill directory (contains SKILL.md)
      if (!existsSync(pathJoin(resolvedPath, 'SKILL.md'))) {
        return res.status(400).json({ error: 'Not a valid skill directory (SKILL.md not found)' })
      }
      const name = importSkill(resolvedPath)
      res.status(201).json({ name })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Update skill auth
  router.put('/:name/auth', (req, res) => {
    try {
      const envVars = req.body as Record<string, string>
      for (const [key, value] of Object.entries(envVars)) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          return res.status(400).json({ error: `Invalid env var name: ${key}` })
        }
        if (typeof value !== 'string') {
          return res.status(400).json({ error: `Value for ${key} must be a string` })
        }
        if (value.length > 1000) {
          return res.status(400).json({ error: `Value for ${key} is too long` })
        }
        ctx.configStore.set(`skill_env_${key}` as never, value as never)
      }
      res.json({ status: 'saved' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Delete skill
  router.delete('/:name', async (req, res) => {
    try {
      const skillName = req.params.name!

      // Prevent deletion of built-in skill
      if (skillName === 'openstaff') {
        return res.status(400).json({ error: 'Cannot delete the built-in openstaff skill' })
      }

      // Remove from all connected staffs
      for (const id of listStaffIds()) {
        const config = readStaffConfig(id)
        if (config && config.skills.includes(skillName)) {
          config.skills = config.skills.filter((s) => s !== skillName)
          writeStaffConfig(config)
          symlinkSkills(id, config.skills)
          if (ctx.staffManager.isRunning(id)) {
            await ctx.staffManager.restartStaff(id)
          }
        }
      }

      deleteSkill(skillName)
      res.status(204).send()
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  return router
}
