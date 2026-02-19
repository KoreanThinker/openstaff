import { describe, it, expect } from 'vitest'
import { getDriver, getAllDrivers, registerDriver } from './agent-registry'

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
