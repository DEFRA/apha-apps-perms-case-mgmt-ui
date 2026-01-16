import { describe, expect, test, vi } from 'vitest'
import { add, sub } from 'date-fns'

import { refreshTokenIfExpired } from './refresh-token.js'
import { refreshUserSession, removeAuthenticatedUser } from './user-session.js'

vi.mock('./user-session.js')

describe('refresh-token', () => {
  test('returns when no user session exists', async () => {
    const request = {
      logger: { info: vi.fn(), debug: vi.fn() }
    }

    const result = await refreshTokenIfExpired(() => {}, request, null)

    expect(result).toBeUndefined()
    expect(refreshUserSession).not.toHaveBeenCalled()
  })

  test('does not refresh when the token has not expired', async () => {
    const request = {
      logger: { info: vi.fn(), debug: vi.fn() }
    }
    const session = {
      expiresAt: add(Date.now(), { minutes: 5 }).toISOString()
    }

    const result = await refreshTokenIfExpired(() => {}, request, session)

    expect(result).toBeUndefined()
    expect(refreshUserSession).not.toHaveBeenCalled()
  })

  test('refreshes the session when the token has expired', async () => {
    const request = {
      logger: { info: vi.fn(), debug: vi.fn() }
    }
    const session = {
      expiresAt: sub(Date.now(), { minutes: 5 }).toISOString(),
      displayName: 'Jane Doe'
    }
    const refreshed = {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600
    }
    const refreshFn = vi.fn().mockResolvedValue(refreshed)

    await refreshTokenIfExpired(refreshFn, request, session)

    expect(refreshFn).toHaveBeenCalledWith(session.refreshToken)
    expect(refreshUserSession).toHaveBeenCalledWith(request, refreshed)
  })

  test('drops the session when refreshing fails', async () => {
    const request = {
      logger: { info: vi.fn(), debug: vi.fn() },
      yar: { flash: vi.fn() }
    }
    const session = {
      expiresAt: sub(Date.now(), { minutes: 5 }).toISOString(),
      displayName: 'Jane Doe'
    }
    const refreshFn = vi.fn().mockRejectedValue(new Error('nope'))

    const result = await refreshTokenIfExpired(refreshFn, request, session)

    expect(result).toBeUndefined()
    expect(removeAuthenticatedUser).toHaveBeenCalledWith(request)
  })
})
