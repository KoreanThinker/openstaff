import { describe, it, expect } from 'vitest'
import { hasChildProcesses } from './process-utils'
import { spawn } from 'child_process'

describe('hasChildProcesses', () => {
  it('returns true for a process with children', async () => {
    // Spawn a shell that keeps running with a child sleep process
    // Using '&' + 'wait' ensures sh stays alive as parent with sleep as child
    const parent = spawn('sh', ['-c', 'sleep 60 & wait'], {
      stdio: 'ignore',
      detached: false
    })

    // Give a moment for the child to start
    await new Promise((r) => setTimeout(r, 300))

    const result = await hasChildProcesses(parent.pid!)
    expect(result).toBe(true)

    parent.kill('SIGTERM')
  })

  it('returns false for a process with no children', async () => {
    // Use our own PID's child: a process that runs standalone
    const standalone = spawn('sleep', ['60'], {
      stdio: 'ignore',
      detached: false
    })

    await new Promise((r) => setTimeout(r, 200))

    // sleep itself has no children
    const result = await hasChildProcesses(standalone.pid!)
    expect(result).toBe(false)

    standalone.kill('SIGTERM')
  })

  it('returns false for a non-existent pid', async () => {
    const result = await hasChildProcesses(999999)
    expect(result).toBe(false)
  })
})
