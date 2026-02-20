import { describe, expect, it } from 'vitest'
import { CodexDriver } from './codex-driver'

describe('CodexDriver', () => {
  it('resume() throws if sessionId is missing', () => {
    const driver = new CodexDriver()
    expect(() => driver.resume({
      workingDir: '/tmp',
      claudeMdPath: '/tmp/AGENTS.md',
      env: {}
    })).toThrow('sessionId is required for resume()')
  })

  it('returns built-in models', () => {
    const driver = new CodexDriver()
    const models = driver.getAvailableModels()
    expect(models.length).toBeGreaterThan(0)
    expect(models.some((m) => m.id === 'gpt-5')).toBe(true)
  })
})
