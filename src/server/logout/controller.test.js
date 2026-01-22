import { describe, expect, test, vi } from 'vitest'

import { logoutController } from './controller.js'
import { config } from '../../config/config.js'

vi.mock('../common/helpers/auth/user-session.js', () => ({
  removeAuthenticatedUser: vi.fn()
}))

vi.mock('../common/helpers/auth/fetch-well-known.js', () => ({
  fetchWellknown: vi.fn().mockResolvedValue({
    end_session_endpoint: 'https://login.example.com/logout'
  })
}))

describe('logoutController', () => {
  test('builds encoded logout URL and clears session', async () => {
    const redirect = vi.fn().mockReturnValue('redirected')
    const h = { redirect }
    const appBaseUrl = config.get('appBaseUrl')
    const request = {
      auth: { credentials: { loginHint: 'user hint' } },
      info: { referrer: `${appBaseUrl}/path?param=space here` }
    }

    const result = await logoutController.handler(request, h)

    const calledUrl = redirect.mock.calls[0][0]
    expect(calledUrl).toContain('logout_hint=user%20hint')
    expect(calledUrl).toContain(
      'post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fpath%3Fparam%3Dspace%2520here'
    )
    expect(result).toBe('redirected')
  })

  test('redirects home when no session exists', async () => {
    const redirect = vi.fn().mockReturnValue('redirected')
    const h = { redirect }
    const request = {
      auth: { credentials: null },
      info: { referrer: null }
    }

    const result = await logoutController.handler(request, h)

    expect(redirect).toHaveBeenCalledWith('/')
    expect(result).toBe('redirected')
  })
})
