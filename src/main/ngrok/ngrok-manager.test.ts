import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NgrokManager } from './ngrok-manager'
import type { ConfigStore } from '../store/config-store'

// @ngrok/ngrok is an external network service — acceptable to mock per CLAUDE.md policy
vi.mock('@ngrok/ngrok', () => ({
  forward: vi.fn(),
  disconnect: vi.fn()
}))

function makeStore(overrides: Record<string, string> = {}): ConfigStore {
  const data: Record<string, string> = {
    ngrok_api_key: '',
    ngrok_auth_password: '',
    ...overrides
  }
  return {
    get: vi.fn((key: string) => data[key] || ''),
    set: vi.fn(),
    getAll: vi.fn(() => data)
  } as unknown as ConfigStore
}

describe('NgrokManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no API key is configured', async () => {
    const manager = new NgrokManager(makeStore())
    const result = await manager.start(3000)
    expect(result).toBeNull()
    expect(manager.isActive()).toBe(false)
  })

  it('starts tunnel with API key', async () => {
    const ngrok = await import('@ngrok/ngrok')
    const mockForward = vi.mocked(ngrok.forward)
    mockForward.mockResolvedValue({ url: () => 'https://abc123.ngrok.app' } as never)

    const store = makeStore({ ngrok_api_key: 'test-key' })
    const manager = new NgrokManager(store)
    const result = await manager.start(3000)

    expect(result).toBe('https://abc123.ngrok.app')
    expect(manager.isActive()).toBe(true)
    expect(manager.getUrl()).toBe('https://abc123.ngrok.app')
    expect(mockForward).toHaveBeenCalledWith({
      addr: 3000,
      authtoken: 'test-key',
      proto: 'http'
    })
  })

  it('includes basic_auth when password is set', async () => {
    const ngrok = await import('@ngrok/ngrok')
    const mockForward = vi.mocked(ngrok.forward)
    mockForward.mockResolvedValue({ url: () => 'https://xyz.ngrok.app' } as never)

    const store = makeStore({
      ngrok_api_key: 'test-key',
      ngrok_auth_password: 'secret123'
    })
    const manager = new NgrokManager(store)
    await manager.start(4000)

    expect(mockForward).toHaveBeenCalledWith({
      addr: 4000,
      authtoken: 'test-key',
      proto: 'http',
      basic_auth: 'openstaff:secret123'
    })
  })

  it('returns null and sets inactive on forward error', async () => {
    const ngrok = await import('@ngrok/ngrok')
    const mockForward = vi.mocked(ngrok.forward)
    mockForward.mockRejectedValue(new Error('connection failed'))

    const store = makeStore({ ngrok_api_key: 'test-key' })
    const manager = new NgrokManager(store)
    const result = await manager.start(3000)

    expect(result).toBeNull()
    expect(manager.isActive()).toBe(false)
  })

  it('stops tunnel and resets state', async () => {
    const ngrok = await import('@ngrok/ngrok')
    const mockForward = vi.mocked(ngrok.forward)
    const mockDisconnect = vi.mocked(ngrok.disconnect)
    mockForward.mockResolvedValue({ url: () => 'https://test.ngrok.app' } as never)
    mockDisconnect.mockResolvedValue(undefined as never)

    const store = makeStore({ ngrok_api_key: 'test-key' })
    const manager = new NgrokManager(store)

    await manager.start(3000)
    expect(manager.isActive()).toBe(true)
    expect(manager.getUrl()).toBe('https://test.ngrok.app')

    await manager.stop()
    expect(manager.isActive()).toBe(false)
    expect(manager.getUrl()).toBeNull()
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('stop handles disconnect errors gracefully', async () => {
    const ngrok = await import('@ngrok/ngrok')
    vi.mocked(ngrok.disconnect).mockRejectedValue(new Error('not connected'))

    const manager = new NgrokManager(makeStore())
    // Should not throw
    await manager.stop()
    expect(manager.isActive()).toBe(false)
  })

  it('handles null URL from listener', async () => {
    const ngrok = await import('@ngrok/ngrok')
    vi.mocked(ngrok.forward).mockResolvedValue({ url: () => null } as never)

    const store = makeStore({ ngrok_api_key: 'test-key' })
    const manager = new NgrokManager(store)
    const result = await manager.start(3000)

    expect(result).toBeNull()
    expect(manager.isActive()).toBe(false)
  })

  it('instances do not share state', async () => {
    const ngrok = await import('@ngrok/ngrok')
    vi.mocked(ngrok.forward).mockResolvedValue({ url: () => 'https://a.ngrok.app' } as never)

    const store = makeStore({ ngrok_api_key: 'test-key' })
    const manager1 = new NgrokManager(store)
    const manager2 = new NgrokManager(store)

    await manager1.start(3000)
    expect(manager1.isActive()).toBe(true)
    expect(manager2.isActive()).toBe(false)
    expect(manager2.getUrl()).toBeNull()
  })
})
