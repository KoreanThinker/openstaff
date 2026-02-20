import { describe, it, expect } from 'vitest'
import { getDriver, getAllDrivers, registerDriver } from './agent-registry'
import { ClaudeCodeDriver } from './claude-code-driver'
import { CodexDriver } from './codex-driver'
import { GeminiCliDriver } from './gemini-cli-driver'

describe('agent-registry', () => {
  it('has claude-code driver registered by default', () => {
    const driver = getDriver('claude-code')
    expect(driver).toBeDefined()
    expect(driver!.id).toBe('claude-code')
    expect(driver!.name).toBe('Claude Code')
  })

  it('returns undefined for unknown driver', () => {
    expect(getDriver('unknown')).toBeUndefined()
  })

  it('lists all registered drivers', () => {
    const drivers = getAllDrivers()
    expect(drivers.length).toBeGreaterThanOrEqual(1)
    expect(drivers.some((d) => d.id === 'claude-code')).toBe(true)
    expect(drivers.some((d) => d.id === 'codex')).toBe(true)
    expect(drivers.some((d) => d.id === 'gemini-cli')).toBe(true)
  })

  it('can register a new driver', () => {
    const mockDriver = {
      id: 'test-driver',
      name: 'Test Driver',
      isInstalled: async () => false,
      install: async () => {},
      getVersion: async () => null,
      getBinaryPath: () => '/test',
      getAvailableModels: () => [],
      spawn: () => ({} as never),
      resume: () => ({} as never),
      testConnection: async () => false
    }
    registerDriver(mockDriver)
    expect(getDriver('test-driver')).toBeDefined()
  })
})

describe('ClaudeCodeDriver', () => {
  it('resume() throws if sessionId is missing', () => {
    const driver = new ClaudeCodeDriver()
    expect(() => driver.resume({
      workingDir: '/tmp',
      claudeMdPath: '/tmp/CLAUDE.md',
      env: {}
    })).toThrow('sessionId is required for resume()')
  })
})

describe('CodexDriver', () => {
  it('resume() throws if sessionId is missing', () => {
    const driver = new CodexDriver()
    expect(() => driver.resume({
      workingDir: '/tmp',
      claudeMdPath: '/tmp/AGENTS.md',
      env: {}
    })).toThrow('sessionId is required for resume()')
  })

  it('provides built-in model list', () => {
    const driver = new CodexDriver()
    expect(driver.getAvailableModels().length).toBeGreaterThan(0)
  })
})

describe('GeminiCliDriver', () => {
  it('resume() throws if sessionId is missing', () => {
    const driver = new GeminiCliDriver()
    expect(() => driver.resume({
      workingDir: '/tmp',
      claudeMdPath: '/tmp/AGENTS.md',
      env: {}
    })).toThrow('sessionId is required for resume()')
  })

  it('provides built-in model list', () => {
    const driver = new GeminiCliDriver()
    expect(driver.getAvailableModels().length).toBeGreaterThan(0)
  })
})
