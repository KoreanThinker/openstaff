import { execFile } from 'child_process'

/**
 * Check if a process has any child processes using pgrep.
 * Returns true if the process has at least one child, false otherwise.
 */
export function hasChildProcesses(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('pgrep', ['-P', String(pid)], (err, stdout) => {
      if (err) {
        // pgrep returns exit code 1 when no processes match
        resolve(false)
        return
      }
      resolve(stdout.trim().length > 0)
    })
  })
}
