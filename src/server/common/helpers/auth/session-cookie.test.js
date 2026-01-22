import { beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'

import { sessionCookie } from './session-cookie.js'

describe('session-cookie validate', () => {
  let server
  let app
  let validateFn
  let session

  beforeEach(async () => {
    server = hapi.server()
    app = /** @type {any} */ (server.app)
    session = { get: vi.fn() }
    app.session = session
    app.refreshUserSession = vi.fn()

    const strategySpy = vi.spyOn(server.auth, 'strategy')
    await sessionCookie.plugin.register(server)
    const strategyCall = strategySpy.mock.calls[0]
    validateFn = strategyCall?.[2]?.validate
    if (!validateFn) {
      throw new Error('session validate function not registered')
    }
  })

  test('returns isValid false when there is no session', async () => {
    session.get.mockResolvedValue(null)
    const request = { server, state: {} }

    const result = await validateFn(request, { sessionId: 'session-id' })

    expect(result).toEqual({ isValid: false })
  })

  test('returns isValid true when session exists', async () => {
    const userSession = {
      id: 'user-1',
      isAuthenticated: true,
      token: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2999-01-01T00:00:00.000Z'
    }
    const refreshedSession = {
      ...userSession,
      token: 'new-access-token'
    }
    session.get.mockResolvedValue(userSession)
    const refreshUserSession = vi.fn().mockResolvedValue(refreshedSession)
    app.refreshUserSession = refreshUserSession
    const request = { server, state: {} }

    const result = await validateFn(request, { sessionId: 'session-id' })

    expect(refreshUserSession).toHaveBeenCalledWith(request, userSession)
    expect(result).toEqual({
      isValid: true,
      credentials: refreshedSession
    })
  })
})
