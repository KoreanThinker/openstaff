import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SlackNotifier } from './slack-notifier'

describe('SlackNotifier', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('does nothing when webhook URL is not configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const notifier = new SlackNotifier({
      get: () => ''
    } as never)

    await notifier.notify('Staff Error', 'Worker crashed')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts formatted message to configured webhook', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const notifier = new SlackNotifier({
      get: () => 'https://hooks.slack.com/services/T/B/X'
    } as never)

    await notifier.notify('Staff Error', 'Worker crashed')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [, request] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(request.method).toBe('POST')
    expect(String(request.body)).toContain('*Staff Error*')
    expect(String(request.body)).toContain('Worker crashed')
  })

  it('swallows webhook delivery failures', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', fetchSpy)

    const notifier = new SlackNotifier({
      get: () => 'https://hooks.slack.com/services/T/B/X'
    } as never)

    await expect(notifier.notify('Budget Warning', '85% reached')).resolves.toBeUndefined()
  })
})
