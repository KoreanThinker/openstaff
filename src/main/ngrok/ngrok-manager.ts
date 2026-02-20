import type { ConfigStore } from '../store/config-store'

export class NgrokManager {
  private configStore: ConfigStore
  private tunnelUrl: string | null = null
  private tunnelActive = false
  private lastError: string | null = null

  constructor(configStore: ConfigStore) {
    this.configStore = configStore
  }

  async start(port: number): Promise<string | null> {
    const apiKey = this.configStore.get('ngrok_api_key')
    if (!apiKey) return null

    try {
      // Dynamic import to avoid bundling ngrok when not used
      const ngrok = await import('@ngrok/ngrok')
      const authPassword = this.configStore.get('ngrok_auth_password')
      const listener = await ngrok.forward({
        addr: port,
        authtoken: apiKey,
        proto: 'http',
        ...(authPassword ? { basic_auth: `openstaff:${authPassword}` } : {})
      })

      this.tunnelUrl = listener.url() || null
      this.tunnelActive = this.tunnelUrl !== null
      this.lastError = null

      console.log(`Ngrok tunnel active: ${this.tunnelUrl}`)
      return this.tunnelUrl
    } catch (err) {
      console.error('Failed to start ngrok tunnel:', err)
      this.tunnelActive = false
      this.lastError = err instanceof Error ? err.message : String(err)
      return null
    }
  }

  async stop(): Promise<void> {
    try {
      const ngrok = await import('@ngrok/ngrok')
      await ngrok.disconnect()
      this.tunnelUrl = null
      this.tunnelActive = false
    } catch {
      // Ignore
    }
  }

  getUrl(): string | null {
    return this.tunnelUrl
  }

  isActive(): boolean {
    return this.tunnelActive
  }

  getError(): string | null {
    return this.lastError
  }
}
