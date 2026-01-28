import { describe, expect, test, vi } from 'vitest'

import { getUserSession } from './get-user-session.js'

describe('getUserSession', () => {
  test('returns null when no session id or server session is available', async () => {
    const request = { state: { userSessionCookie: {} }, server: {} }
    const result = await getUserSession(request)

    expect(result).toBeNull()
  })

  test('returns cached session when available', async () => {
    const get = vi.fn().mockResolvedValue({ id: 'user-1' })
    const sessionId = 'session-id'
    const request = {
      state: { userSessionCookie: { sessionId } },
      server: { app: { session: { get } } }
    }
    const result = await getUserSession(request)

    expect(get).toHaveBeenCalledWith(sessionId)
    expect(result).toEqual({ id: 'user-1' })
  })
})
