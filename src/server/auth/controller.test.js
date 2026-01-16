import { describe, expect, test, vi } from 'vitest'

import { authCallbackController } from './controller.js'

const { createUserSession, redirectWithRefresh } = vi.hoisted(() => ({
  createUserSession: vi.fn(),
  redirectWithRefresh: vi.fn((_h, redirect) => ({
    redirectedTo: redirect
  }))
}))

vi.mock('node:crypto', () => ({
  randomUUID: () => 'session-123'
}))

vi.mock('../common/helpers/auth/user-session.js', () => ({
  createUserSession
}))

vi.mock('../common/helpers/url/url-helpers.js', () => ({
  redirectWithRefresh
}))

describe('authCallbackController', () => {
  const buildRequest = ({
    isAuthenticated = true,
    flashReturn = ['/next']
  } = {}) => {
    const logger = { info: vi.fn() }
    return {
      auth: { isAuthenticated },
      sessionCookie: { set: vi.fn() },
      yar: { flash: vi.fn().mockReturnValue(flashReturn) },
      logger
    }
  }

  test('creates session, sets cookie and audits when authenticated', async () => {
    const request = buildRequest()
    createUserSession.mockResolvedValue({})

    const h = {}
    const response = await authCallbackController.handler(request, h)

    expect(createUserSession).toHaveBeenCalledWith(request, 'session-123')
    expect(request.sessionCookie.set).toHaveBeenCalledWith({
      sessionId: 'session-123'
    })
    expect(redirectWithRefresh).toHaveBeenCalledWith(h, '/next')
    expect(response).toEqual({ redirectedTo: '/next' })
  })

  test('skips session creation when unauthenticated and redirects home', async () => {
    const request = buildRequest({ isAuthenticated: false, flashReturn: [] })
    const h = {}

    const response = await authCallbackController.handler(request, h)

    expect(createUserSession).not.toHaveBeenCalled()
    expect(request.sessionCookie.set).not.toHaveBeenCalled()
    expect(redirectWithRefresh).toHaveBeenCalledWith(h, '/')
    expect(response).toEqual({ redirectedTo: '/' })
  })
})
