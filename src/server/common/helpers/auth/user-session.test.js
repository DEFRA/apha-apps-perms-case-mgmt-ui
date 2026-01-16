import { describe, expect, test, vi } from 'vitest'
import jwt from '@hapi/jwt'

import {
  createUserSession,
  refreshUserSession,
  removeAuthenticatedUser
} from './user-session.js'

describe('user-session', () => {
  test('removeAuthenticatedUser drops session and clears cookies', () => {
    const clear = vi.fn()
    const unstate = vi.fn()
    const dropUserSession = vi.fn()
    const request = {
      dropUserSession,
      sessionCookie: {
        clear,
        h: {
          unstate
        }
      }
    }

    removeAuthenticatedUser(request)

    expect(dropUserSession).toHaveBeenCalled()
    expect(clear).toHaveBeenCalled()
    expect(unstate).toHaveBeenCalledWith('csrfToken')
    expect(unstate).toHaveBeenCalledWith('userSessionCookie')
  })

  test('createUserSession stores session details', async () => {
    const set = vi.fn()
    const request = {
      logger: { debug: vi.fn(), info: vi.fn() },
      auth: {
        isAuthenticated: true,
        credentials: {
          expiresIn: 3600,
          token: 'access-token',
          refreshToken: 'refresh-token',
          profile: {
            id: 'user-1',
            email: 'user@example.com',
            displayName: 'User One',
            loginHint: 'hint'
          }
        }
      },
      server: {
        session: { set }
      }
    }

    const sessionId = 'session-id'
    const session = await createUserSession(request, sessionId)

    expect(set).toHaveBeenCalledWith(
      sessionId,
      expect.objectContaining({ id: 'user-1' })
    )
    expect(session.email).toBe('user@example.com')
    expect(session.token).toBe('access-token')
  })

  test('refreshUserSession updates the cached session from the refreshed token', async () => {
    const payload = {
      oid: 'user-1',
      preferred_username: 'user@example.com',
      name: 'User One',
      login_hint: 'hint'
    }
    const jwtToken = jwt.token.generate(payload, {
      key: 'secret',
      algorithm: 'HS256'
    })

    const set = vi.fn()
    const request = {
      logger: { info: vi.fn(), debug: vi.fn() },
      server: { session: { set } },
      state: { userSessionCookie: { sessionId: 'session-id' } }
    }
    const refreshTokenResponse = {
      access_token: jwtToken,
      refresh_token: 'new-refresh',
      expires_in: 3600
    }

    const session = await refreshUserSession(request, refreshTokenResponse)

    expect(set).toHaveBeenCalledWith(
      'session-id',
      expect.objectContaining({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'User One',
        refreshToken: 'new-refresh'
      })
    )
    expect(session.id).toBe('user-1')
    expect(session.token).toBe(jwtToken)
  })
})
