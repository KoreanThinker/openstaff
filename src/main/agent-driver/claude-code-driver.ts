import { spawn as ptySpawn } from 'node-pty'
import { existsSync } from 'fs'
import { join } from 'path'
import { TOOLS_DIR, CLAUDE_CODE_MODELS } from '@shared/constants'
import type { AgentDriver, AgentProcess, AgentModel, SpawnOptions } from '@shared/types'

export class ClaudeCodeDriver implements AgentDriver {
  readonly id = 'claude-code'
  readonly name = 'Claude Code'

  async isInstalled(): Promise<boolean> {
    const binPath = this.getBinaryPath()
    return existsSync(binPath)
  }

  async install(onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      onProgress?.(0)
      const proc = ptySpawn('npm', [
        'install',
        '--prefix', TOOLS_DIR,
        '@anthropic-ai/claude-code'
      ], {
        name: 'xterm',
        cols: 120,
        rows: 30,
        cwd: TOOLS_DIR
      })

      let output = ''
      proc.onData((data) => {
        output += data
        // Rough progress estimation
        if (output.includes('added')) onProgress?.(90)
        else if (output.includes('reify')) onProgress?.(50)
        else if (output.includes('idealTree')) onProgress?.(20)
      })

      proc.onExit(({ exitCode }) => {
        if (exitCode === 0) {
          onProgress?.(100)
          resolve()
        } else {
          reject(new Error(`Installation failed with exit code ${exitCode}`))
        }
      })
    })
  }

  async getVersion(): Promise<string | null> {
    const pkgPath = join(TOOLS_DIR, 'node_modules', '@anthropic-ai', 'claude-code', 'package.json')
    if (!existsSync(pkgPath)) return null
    const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf-8'))
    return pkg.version || null
  }

  getBinaryPath(): string {
    return join(TOOLS_DIR, 'node_modules', '.bin', 'claude')
  }

  getAvailableModels(): AgentModel[] {
    return CLAUDE_CODE_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description
    }))
  }

  async testConnection(apiKey: string): Promise<boolean> {
    return new Promise((resolve) => {
      const binPath = this.getBinaryPath()
      if (!existsSync(binPath)) {
        resolve(false)
        return
      }

      const proc = ptySpawn(binPath, ['--version'], {
        name: 'xterm',
        cols: 80,
        rows: 24,
        env: { ...process.env, ANTHROPIC_API_KEY: apiKey }
      })

      let output = ''
      const timeout = setTimeout(() => {
        proc.kill()
        resolve(output.length > 0)
      }, 10000)

      proc.onData((data) => {
        output += data
      })

      proc.onExit(({ exitCode }) => {
        clearTimeout(timeout)
        resolve(exitCode === 0)
      })
    })
  }

  private cleanEnv(extra: Record<string, string> = {}): Record<string, string> {
    const env = { ...process.env, ...extra } as Record<string, string>
    // Remove vars that prevent nested Claude Code sessions
    delete env['CLAUDECODE']
    delete env['CLAUDE_CODE_SESSION']
    return env
  }

  spawn(opts: SpawnOptions): AgentProcess {
    const binPath = this.getBinaryPath()
    const args = [
      '--dangerously-skip-permissions',
      '--setting-sources', 'project,local',
      '--strict-mcp-config', '--mcp-config', join(opts.workingDir, 'staff-mcp.json'),
      '--verbose'
    ]

    if (opts.model) {
      args.push('--model', opts.model)
    }

    const pty = ptySpawn(binPath, args, {
      name: 'xterm-256color',
      cols: 200,
      rows: 50,
      cwd: opts.workingDir,
      env: this.cleanEnv(opts.env)
    })

    return this.wrapPty(pty)
  }

  resume(opts: SpawnOptions): AgentProcess {
    if (!opts.sessionId) {
      throw new Error('sessionId is required for resume()')
    }
    const binPath = this.getBinaryPath()
    const args = [
      '--resume', opts.sessionId,
      '--dangerously-skip-permissions',
      '--setting-sources', 'project,local',
      '--strict-mcp-config', '--mcp-config', join(opts.workingDir, 'staff-mcp.json'),
      '--verbose'
    ]

    if (opts.model) {
      args.push('--model', opts.model)
    }

    const pty = ptySpawn(binPath, args, {
      name: 'xterm-256color',
      cols: 200,
      rows: 50,
      cwd: opts.workingDir,
      env: this.cleanEnv(opts.env)
    })

    return this.wrapPty(pty)
  }

  private wrapPty(pty: ReturnType<typeof ptySpawn>): AgentProcess {
    const agentProc: AgentProcess = {
      pid: pty.pid,
      sessionId: null,
      write(message: string): void {
        // Send message text first, then Enter after a small delay
        // Claude Code's ink-based UI needs time to register the text
        pty.write(message)
        setTimeout(() => pty.write('\r'), 100)
      },
      onData(cb: (data: string) => void): void {
        pty.onData(cb)
      },
      onExit(cb: (code: number) => void): void {
        pty.onExit(({ exitCode }) => cb(exitCode))
      },
      async kill(): Promise<void> {
        const treeKill = require('tree-kill')

        // PRD: SIGTERM → 5s wait → SIGKILL
        await new Promise<void>((resolve) => {
          treeKill(pty.pid, 'SIGTERM', (err: Error | null) => {
            if (err) {
              resolve() // Process already dead or error
              return
            }
            // Wait 5s for graceful shutdown
            setTimeout(() => {
              try {
                process.kill(pty.pid, 0) // Check if still alive
                treeKill(pty.pid, 'SIGKILL', () => resolve())
              } catch {
                resolve() // Already dead
              }
            }, 5000)
          })
        })
      }
    }

    // Extract session ID from Claude Code output (printed during startup)
    // Pattern: "Session: <uuid>" or "session_id: <uuid>"
    const sessionIdRegex = /(?:Session|session_id|Session ID)[:\s]+([a-f0-9-]{36})/i
    let parsed = false
    pty.onData((data: string) => {
      if (parsed) return
      const match = data.match(sessionIdRegex)
      if (match) {
        agentProc.sessionId = match[1]!
        parsed = true
      }
    })

    return agentProc
  }
}
