import { beforeEach, describe, expect, test, vi } from 'vitest'

import { authCallbackController } from './controller.js'

const { createUserSession, redirectWithRefresh } = vi.hoisted(() => ({
  createUserSession: vi.fn(),
  redirectWithRefresh: vi.fn((_h, redirect) => ({
    redirectedTo: redirect
  }))
}))

const { integrationClient } = vi.hoisted(() => ({
  /** @type {{ findCaseManagementUser: import('vitest').Mock }} */
  integrationClient: { findCaseManagementUser: vi.fn() }
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

vi.mock('../common/helpers/integration-bridge/index.js', () => ({
  integrationClient
}))

describe('authCallbackController', () => {
  beforeEach(() => {
    integrationClient.findCaseManagementUser = vi
      .fn()
      .mockResolvedValue({ data: [{ id: 'user-123' }] })
    createUserSession.mockReset()
    redirectWithRefresh.mockClear()
  })

  /**
   * @param {{
   *   isAuthenticated?: boolean
   *   flashReturn?: string[]
   *   findCaseManagementUser?: import('vitest').Mock
   * }} [options]
   */
  const buildRequest = ({
    isAuthenticated = true,
    flashReturn = ['/next'],
    findCaseManagementUser
  } = {}) => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    if (findCaseManagementUser) {
      integrationClient.findCaseManagementUser = findCaseManagementUser
    }
    return {
      auth: {
        isAuthenticated,
        credentials: { profile: { email: 'user@example.com' } }
      },
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
    expect(integrationClient.findCaseManagementUser).toHaveBeenCalledWith(
      'user@example.com'
    )
    expect(redirectWithRefresh).toHaveBeenCalledWith(h, '/next')
    expect(response).toEqual({ redirectedTo: '/next' })
  })

  test('skips session creation when unauthenticated and redirects home', async () => {
    const request = buildRequest({ isAuthenticated: false, flashReturn: [] })
    const h = {}

    const response = await authCallbackController.handler(request, h)

    expect(createUserSession).not.toHaveBeenCalled()
    expect(request.sessionCookie.set).not.toHaveBeenCalled()
    expect(integrationClient.findCaseManagementUser).not.toHaveBeenCalled()
    expect(redirectWithRefresh).toHaveBeenCalledWith(h, '/')
    expect(response).toEqual({ redirectedTo: '/' })
  })

  test('rejects login when user is not found in case management', async () => {
    const request = buildRequest({
      findCaseManagementUser: vi.fn().mockResolvedValue({ data: [] })
    })
    const h = {}

    await expect(authCallbackController.handler(request, h)).rejects.toThrow(
      /not authorised/i
    )
    expect(request.sessionCookie.set).not.toHaveBeenCalled()
  })

  test('returns an error when integration bridge fails', async () => {
    const request = buildRequest({
      findCaseManagementUser: vi
        .fn()
        .mockRejectedValue(new Error('bridge offline'))
    })
    const h = {}

    await expect(authCallbackController.handler(request, h)).rejects.toThrow(
      /Unable to verify your access/
    )
    expect(request.sessionCookie.set).not.toHaveBeenCalled()
  })
})
