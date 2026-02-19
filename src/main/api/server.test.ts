import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'

// We can't fully test server.ts because it depends on socket.io and staffManager events
// But we can verify the module structure
describe('server module', () => {
  it('exports startApiServer and getApiPort', async () => {
    // Just verify the module can be imported (validates types and structure)
    const module = await import('./server')
    expect(typeof module.startApiServer).toBe('function')
    expect(typeof module.getApiPort).toBe('function')
  })

  it('getApiPort returns 0 before server starts', async () => {
    const { getApiPort } = await import('./server')
    expect(getApiPort()).toBe(0)
  })
})
