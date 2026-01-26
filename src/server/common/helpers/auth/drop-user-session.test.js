import { describe, expect, test, vi } from 'vitest'

import { dropUserSession } from './drop-user-session.js'

describe('dropUserSession', () => {
  test('returns early when no session id is available', async () => {
    const server = { app: { session: { drop: vi.fn() } } }
    const request = { server, state: {} }

    await dropUserSession(request)

    expect(server.app.session.drop).not.toHaveBeenCalled()
  })

  test('drops the session when an id is present', async () => {
    const drop = vi.fn()
    const request = {
      server: { app: { session: { drop } } },
      state: { userSessionCookie: { sessionId: 'abc' } }
    }

    await dropUserSession(request)

    expect(drop).toHaveBeenCalledWith('abc')
  })
})
