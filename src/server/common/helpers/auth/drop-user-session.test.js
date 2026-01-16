import { describe, expect, test, vi } from 'vitest'

import { dropUserSession } from './drop-user-session.js'

describe('dropUserSession', () => {
  test('returns early when no session id is available', async () => {
    const server = { session: { drop: vi.fn() } }

    await dropUserSession.call({ server, state: {} })

    expect(server.session.drop).not.toHaveBeenCalled()
  })

  test('drops the session when an id is present', async () => {
    const drop = vi.fn()
    const context = {
      server: { session: { drop } },
      state: { userSessionCookie: { sessionId: 'abc' } }
    }

    await dropUserSession.call(context)

    expect(drop).toHaveBeenCalledWith('abc')
  })
})
