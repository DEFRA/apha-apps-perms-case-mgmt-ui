import { beforeEach, describe, expect, test, vi } from 'vitest'

import { authCallbackController } from './callback.js'
import { FindCaseManagementUserCommand } from '../common/helpers/integration-bridge/commands/find-case-management-user.js'

const { createUserSession, redirectWithRefresh } = vi.hoisted(() => ({
  createUserSession: vi.fn(),
  redirectWithRefresh: vi.fn((_h, redirect) => ({
    redirectedTo: redirect
  }))
}))

const { integrationClient } = vi.hoisted(() => ({
  /** @type {{ send: import('vitest').Mock }} */
  integrationClient: { send: vi.fn() }
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
    integrationClient.send = vi
      .fn()
      .mockResolvedValue({ data: [{ id: 'user-123' }] })
    createUserSession.mockReset()
    redirectWithRefresh.mockClear()
  })

  /**
   * @param {{
   *   isAuthenticated?: boolean
   *   flashReturn?: string[]
   *   send?: import('vitest').Mock
   * }} [options]
   */
  const buildRequest = ({
    isAuthenticated = true,
    flashReturn = ['/next'],
    send
  } = {}) => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    if (send) {
      integrationClient.send = send
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
    expect(integrationClient.send).toHaveBeenCalledTimes(1)
    const [command] = integrationClient.send.mock.calls[0]
    expect(command).toBeInstanceOf(FindCaseManagementUserCommand)
    expect(command.input).toEqual({ emailAddress: 'user@example.com' })
    expect(redirectWithRefresh).toHaveBeenCalledWith(h, '/next')
    expect(response).toEqual({ redirectedTo: '/next' })
  })

  test('skips session creation when unauthenticated and redirects home', async () => {
    const request = buildRequest({ isAuthenticated: false, flashReturn: [] })
    const h = {}

    const response = await authCallbackController.handler(request, h)

    expect(createUserSession).not.toHaveBeenCalled()
    expect(request.sessionCookie.set).not.toHaveBeenCalled()
    expect(integrationClient.send).not.toHaveBeenCalled()
    expect(redirectWithRefresh).toHaveBeenCalledWith(h, '/')
    expect(response).toEqual({ redirectedTo: '/' })
  })

  test('rejects login when user is not found in case management', async () => {
    const request = buildRequest({
      send: vi.fn().mockResolvedValue({ data: [] })
    })
    const h = {}

    await expect(authCallbackController.handler(request, h)).rejects.toThrow(
      /not authorised/i
    )
    expect(request.sessionCookie.set).not.toHaveBeenCalled()
  })

  test('returns an error when integration bridge fails', async () => {
    const request = buildRequest({
      send: vi.fn().mockRejectedValue(new Error('bridge offline'))
    })
    const h = {}

    await expect(authCallbackController.handler(request, h)).rejects.toThrow(
      /Unable to verify your access/
    )
    expect(request.sessionCookie.set).not.toHaveBeenCalled()
  })

  test('rejects when email is missing from the authentication token', async () => {
    const request = buildRequest()
    // @ts-expect-error intentionally clearing email for test coverage
    request.auth.credentials.profile.email = undefined
    const h = {}

    await expect(authCallbackController.handler(request, h)).rejects.toThrow(
      /Email address missing/
    )
    expect(integrationClient.send).not.toHaveBeenCalled()
    expect(request.sessionCookie.set).not.toHaveBeenCalled()
  })

  test('failAction wraps unauthorized errors', () => {
    const boom = authCallbackController.options.response.failAction()

    expect(boom.output.statusCode).toBe(401)
    expect(boom.message).toBe('Unauthorized')
  })
})
