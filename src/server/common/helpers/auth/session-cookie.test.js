import { beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'

import { sessionCookie } from './session-cookie.js'
import { addDecorators } from '../add-decorators.js'

describe('session-cookie validate', () => {
  let server
  let validateFn

  beforeEach(async () => {
    server = hapi.server()
    addDecorators(server)
    server.decorate('request', 'refreshToken', vi.fn())

    const strategySpy = vi.spyOn(server.auth, 'strategy')
    await sessionCookie.plugin.register(server)
    validateFn = strategySpy.mock.calls[0][2].validate
  })

  test('returns isValid false when there is no session', async () => {
    const request = {
      getUserSession: vi.fn().mockResolvedValue(null)
    }

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
    const refreshToken = vi.fn().mockResolvedValue(refreshedSession)
    const request = {
      getUserSession: vi.fn().mockResolvedValue(userSession),
      refreshToken
    }

    const result = await validateFn(request, { sessionId: 'session-id' })

    expect(refreshToken).toHaveBeenCalledWith(userSession)
    expect(result).toEqual({
      isValid: true,
      credentials: refreshedSession
    })
  })
})
