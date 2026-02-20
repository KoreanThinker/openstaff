import { describe, expect, it } from 'vitest'
import { GeminiCliDriver } from './gemini-cli-driver'

describe('GeminiCliDriver', () => {
  it('resume() throws if sessionId is missing', () => {
    const driver = new GeminiCliDriver()
    expect(() => driver.resume({
      workingDir: '/tmp',
      claudeMdPath: '/tmp/AGENTS.md',
      env: {}
    })).toThrow('sessionId is required for resume()')
  })

  it('returns built-in models', () => {
    const driver = new GeminiCliDriver()
    const models = driver.getAvailableModels()
    expect(models.length).toBeGreaterThan(0)
    expect(models.some((m) => m.id === 'gemini-2.5-pro')).toBe(true)
  })
})
