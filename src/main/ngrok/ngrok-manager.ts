import type { ConfigStore } from '../store/config-store'

let tunnelUrl: string | null = null
let tunnelActive = false

export class NgrokManager {
  private configStore: ConfigStore

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

      tunnelUrl = listener.url() || null
      tunnelActive = true

      console.log(`Ngrok tunnel active: ${tunnelUrl}`)
      return tunnelUrl
    } catch (err) {
      console.error('Failed to start ngrok tunnel:', err)
      tunnelActive = false
      return null
    }
  }

  async stop(): Promise<void> {
    try {
      const ngrok = await import('@ngrok/ngrok')
      await ngrok.disconnect()
      tunnelUrl = null
      tunnelActive = false
    } catch {
      // Ignore
    }
  }

  getUrl(): string | null {
    return tunnelUrl
  }

  isActive(): boolean {
    return tunnelActive
  }
}
