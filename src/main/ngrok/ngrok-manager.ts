import type { ConfigStore } from '../store/config-store'

export class NgrokManager {
  private configStore: ConfigStore
  private tunnelUrl: string | null = null
  private tunnelActive = false
  private lastError: string | null = null
  private listener: { close: () => Promise<void>; url: () => string | null } | null = null
  private currentPort: number | null = null

  constructor(configStore: ConfigStore) {
    this.configStore = configStore
  }

  async start(port: number): Promise<string | null> {
    this.currentPort = port

    // Reset existing tunnel before re-evaluating config to avoid stale exposure.
    if (this.listener) {
      await this.stop()
    }

    const apiKey = this.configStore.get('ngrok_api_key')
    if (!apiKey) {
      this.tunnelUrl = null
      this.tunnelActive = false
      this.lastError = null
      return null
    }

    const authPassword = this.configStore.get('ngrok_auth_password').trim()
    if (!authPassword) {
      this.tunnelUrl = null
      this.tunnelActive = false
      this.lastError = 'Ngrok auth password is required before starting remote access.'
      return null
    }

    try {
      // Dynamic import to avoid bundling ngrok when not used
      const ngrok = await import('@ngrok/ngrok')
      const listener = await ngrok.forward({
        addr: port,
        authtoken: apiKey,
        proto: 'http',
        basic_auth: `openstaff:${authPassword}`
      })

      this.listener = listener
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
      if (this.listener) {
        await this.listener.close()
        this.listener = null
      } else {
        const ngrok = await import('@ngrok/ngrok')
        await ngrok.disconnect()
      }
      this.tunnelUrl = null
      this.tunnelActive = false
    } catch {
      this.listener = null
      this.tunnelUrl = null
      this.tunnelActive = false
    }
  }

  async restartFromConfig(): Promise<string | null> {
    if (this.currentPort === null) return null
    return this.start(this.currentPort)
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
