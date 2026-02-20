import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawn as ptySpawn } from 'node-pty'
import treeKill from 'tree-kill'
import { GEMINI_MODELS, TOOLS_DIR } from '@shared/constants'
import type { AgentDriver, AgentModel, AgentProcess, SpawnOptions } from '@shared/types'

export class GeminiCliDriver implements AgentDriver {
  readonly id = 'gemini-cli'
  readonly name = 'Google Gemini CLI'

  async isInstalled(): Promise<boolean> {
    return this.resolveBinaryPath() !== null
  }

  async install(onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      onProgress?.(0)
      const proc = ptySpawn('npm', [
        'install',
        '--prefix',
        TOOLS_DIR,
        '@google/gemini-cli'
      ], {
        name: 'xterm',
        cols: 120,
        rows: 30,
        cwd: TOOLS_DIR
      })

      let output = ''
      proc.onData((data) => {
        output += data
        if (output.includes('added')) onProgress?.(90)
        else if (output.includes('reify')) onProgress?.(50)
        else if (output.includes('idealTree')) onProgress?.(20)
      })

      proc.onExit(({ exitCode }) => {
        if (exitCode === 0) {
          onProgress?.(100)
          resolve()
        } else {
          reject(new Error(`Gemini CLI installation failed with exit code ${exitCode}`))
        }
      })
    })
  }

  async getVersion(): Promise<string | null> {
    const binPath = this.resolveBinaryPath()
    if (binPath) {
      const result = spawnSync(binPath, ['--version'], {
        encoding: 'utf-8',
        env: this.cleanEnv()
      })
      const text = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
      const match = text.match(/([0-9]+\.[0-9]+\.[0-9]+)/)
      if (match?.[1]) return match[1]
    }

    const pkgPath = join(TOOLS_DIR, 'node_modules', '@google', 'gemini-cli', 'package.json')
    if (!existsSync(pkgPath)) return null

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
      return pkg.version ?? null
    } catch {
      return null
    }
  }

  getBinaryPath(): string {
    return this.resolveBinaryPath() ?? this.localBinaryPath()
  }

  getAvailableModels(): AgentModel[] {
    return GEMINI_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description
    }))
  }

  async testConnection(_apiKey: string): Promise<boolean> {
    const binPath = this.resolveBinaryPath()
    if (!binPath) return false

    const result = spawnSync(binPath, ['--version'], {
      encoding: 'utf-8',
      env: this.cleanEnv()
    })

    return result.status === 0
  }

  spawn(opts: SpawnOptions): AgentProcess {
    const binPath = this.getBinaryPath()
    const args = this.buildCommonArgs(opts)

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
    const args = ['--resume', opts.sessionId, ...this.buildCommonArgs(opts)]

    const pty = ptySpawn(binPath, args, {
      name: 'xterm-256color',
      cols: 200,
      rows: 50,
      cwd: opts.workingDir,
      env: this.cleanEnv(opts.env)
    })

    return this.wrapPty(pty)
  }

  private localBinaryPath(): string {
    return join(TOOLS_DIR, 'node_modules', '.bin', process.platform === 'win32' ? 'gemini.cmd' : 'gemini')
  }

  private resolveBinaryPath(): string | null {
    const localPath = this.localBinaryPath()
    if (existsSync(localPath)) return localPath

    const lookupCmd = process.platform === 'win32' ? 'where' : 'which'
    const result = spawnSync(lookupCmd, ['gemini'], { encoding: 'utf-8' })
    if (result.status !== 0) return null

    const first = (result.stdout || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean)
    return first || null
  }

  private buildCommonArgs(opts: SpawnOptions): string[] {
    const args = [
      '--yolo',
      '--sandbox=false'
    ]

    if (opts.model) {
      args.push('--model', opts.model)
    }

    return args
  }

  private cleanEnv(extra: Record<string, string> = {}): Record<string, string> {
    const env = { ...process.env, ...extra } as Record<string, string>
    delete env['GEMINI_SANDBOX']
    return env
  }

  private wrapPty(pty: ReturnType<typeof ptySpawn>): AgentProcess {
    const disposables: { dispose(): void }[] = []

    const agentProc: AgentProcess = {
      pid: pty.pid,
      sessionId: null,
      write(message: string): void {
        pty.write(message)
        setTimeout(() => pty.write('\r'), 80)
      },
      onData(cb: (data: string) => void): void {
        disposables.push(pty.onData(cb))
      },
      onExit(cb: (code: number) => void): void {
        disposables.push(pty.onExit(({ exitCode }) => cb(exitCode)))
      },
      async kill(): Promise<void> {
        await new Promise<void>((resolve) => {
          treeKill(pty.pid, 'SIGTERM', (err: Error | null) => {
            if (err) {
              resolve()
              return
            }
            setTimeout(() => {
              try {
                process.kill(pty.pid, 0)
                const safetyTimeout = setTimeout(() => resolve(), 10_000)
                treeKill(pty.pid, 'SIGKILL', () => {
                  clearTimeout(safetyTimeout)
                  resolve()
                })
              } catch {
                resolve()
              }
            }, 5000)
          })
        })
      },
      dispose(): void {
        for (const d of disposables) {
          try { d.dispose() } catch { /* already disposed */ }
        }
        disposables.length = 0
      }
    }

    const sessionIdRegex = /(?:Session(?: ID)?|session[_\s-]?id|conversation[_\s-]?id)[:\s]+([a-f0-9-]{8,})/i
    let parsed = false
    disposables.push(pty.onData((data: string) => {
      if (parsed) return
      const match = data.match(sessionIdRegex)
      if (match?.[1]) {
        agentProc.sessionId = match[1]
        parsed = true
      }
    }))

    return agentProc
  }
}
