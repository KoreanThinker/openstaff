import type { ConfigStore } from '../store/config-store'

export class SlackNotifier {
  constructor(private readonly configStore: ConfigStore) {}

  async notify(title: string, body: string): Promise<void> {
    const webhookUrl = this.configStore.get('slack_webhook_url')
    if (!webhookUrl || webhookUrl.trim() === '') return

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*${title}*\n${body}`
        }),
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}`)
      }
    } catch (err) {
      console.error('Failed to send Slack notification:', err)
    }
  }
}
