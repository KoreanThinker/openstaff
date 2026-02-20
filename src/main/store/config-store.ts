import Store from 'electron-store'
import { safeStorage } from 'electron'
import type { AppSettings, SettingsKey } from '@shared/types'

const ENCRYPTED_KEYS: SettingsKey[] = [
  'anthropic_api_key',
  'openai_api_key',
  'ngrok_api_key',
  'ngrok_auth_password'
]

const DEFAULTS: AppSettings = {
  anthropic_api_key: '',
  openai_api_key: '',
  ngrok_api_key: '',
  ngrok_auth_password: '',
  default_agent: 'claude-code',
  default_model: 'claude-sonnet-4-5',
  setup_completed: false,
  start_on_login: true,
  show_window_on_startup: true,
  auto_update_agents: false,
  theme: 'system',
  monthly_budget_usd: 0,
  budget_warning_percent: 80
}

export class ConfigStore {
  private store: Store

  constructor(storeName = 'config') {
    this.store = new Store({ name: storeName })
  }

  get<K extends SettingsKey>(key: K, defaultValue?: AppSettings[K]): AppSettings[K] {
    const raw = this.store.get(key) as string | undefined
    if (raw === undefined) {
      return defaultValue ?? DEFAULTS[key]
    }

    if (ENCRYPTED_KEYS.includes(key) && typeof raw === 'string' && raw.startsWith('encrypted:')) {
      try {
        const encrypted = Buffer.from(raw.slice('encrypted:'.length), 'base64')
        return safeStorage.decryptString(encrypted) as AppSettings[K]
      } catch {
        return defaultValue ?? DEFAULTS[key]
      }
    }

    return raw as AppSettings[K]
  }

  set<K extends SettingsKey>(key: K, value: AppSettings[K]): void {
    if (ENCRYPTED_KEYS.includes(key) && typeof value === 'string' && value !== '') {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value)
        this.store.set(key, `encrypted:${encrypted.toString('base64')}`)
        return
      }
    }
    this.store.set(key, value)
  }

  getAll(): AppSettings {
    const settings = {} as AppSettings
    for (const key of Object.keys(DEFAULTS) as SettingsKey[]) {
      settings[key] = this.get(key) as never
    }
    return settings
  }

  delete(key: SettingsKey): void {
    this.store.delete(key)
  }
}
