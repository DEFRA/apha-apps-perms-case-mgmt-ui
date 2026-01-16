import { describe, expect, test, vi } from 'vitest'

import { getUserSession } from './get-user-session.js'

describe('getUserSession', () => {
  test('returns null when no session id or server session is available', async () => {
    const result = await getUserSession.call({
      state: { userSessionCookie: {} },
      server: {}
    })

    expect(result).toBeNull()
  })

  test('returns cached session when available', async () => {
    const get = vi.fn().mockResolvedValue({ id: 'user-1' })
    const sessionId = 'session-id'
    const result = await getUserSession.call({
      state: { userSessionCookie: { sessionId } },
      server: { session: { get } }
    })

    expect(get).toHaveBeenCalledWith(sessionId)
    expect(result).toEqual({ id: 'user-1' })
  })
})
