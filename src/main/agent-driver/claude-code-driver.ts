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

  spawn(opts: SpawnOptions): AgentProcess {
    const binPath = this.getBinaryPath()
    const args = [
      '--dangerously-skip-permissions',
      '--setting-sources', 'project,local',
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
      env: { ...process.env, ...opts.env }
    })

    return this.wrapPty(pty)
  }

  resume(opts: SpawnOptions): AgentProcess {
    const binPath = this.getBinaryPath()
    const args = [
      '--resume', opts.sessionId!,
      '--dangerously-skip-permissions',
      '--setting-sources', 'project,local',
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
      env: { ...process.env, ...opts.env }
    })

    return this.wrapPty(pty)
  }

  private wrapPty(pty: ReturnType<typeof ptySpawn>): AgentProcess {
    return {
      pid: pty.pid,
      sessionId: null,
      write(message: string): void {
        pty.write(message + '\n')
      },
      onData(cb: (data: string) => void): void {
        pty.onData(cb)
      },
      onExit(cb: (code: number) => void): void {
        pty.onExit(({ exitCode }) => cb(exitCode))
      },
      async kill(): Promise<void> {
        const treeKill = require('tree-kill')
        return new Promise<void>((resolve) => {
          treeKill(pty.pid, 'SIGTERM', (err: Error | null) => {
            if (err) {
              treeKill(pty.pid, 'SIGKILL', () => resolve())
            } else {
              resolve()
            }
          })
        })
      }
    }
  }
}
