import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import jwt from '@hapi/jwt'

import {
  federatedOidc,
  refreshToken,
  referrerFlashKey
} from './federated-oidc.js'
import { config } from '../../../../config/config.js'
import * as refreshTokenModule from './refresh-token.js'

const discoveryMock = vi.fn()
const buildAuthorizationUrl = vi.fn()
const authorizationCodeGrant = vi.fn()
const refreshTokenGrant = vi.fn()
const randomPKCECodeVerifier = vi.fn()
const calculatePKCECodeChallenge = vi.fn()
const randomNonce = vi.fn()

const { allowInsecureRequests } = vi.hoisted(() => ({
  allowInsecureRequests: vi.fn()
}))

vi.mock('openid-client', () => ({
  discovery: (...args) => discoveryMock(...args),
  buildAuthorizationUrl: (...args) => buildAuthorizationUrl(...args),
  authorizationCodeGrant: (...args) => authorizationCodeGrant(...args),
  refreshTokenGrant: (...args) => refreshTokenGrant(...args),
  randomPKCECodeVerifier: (...args) => randomPKCECodeVerifier(...args),
  calculatePKCECodeChallenge: (...args) => calculatePKCECodeChallenge(...args),
  randomNonce: (...args) => randomNonce(...args),
  allowInsecureRequests
}))

const originalMocking = config.get('azureFederatedCredentials.enableMocking')

afterEach(() => {
  config.set('azureFederatedCredentials.enableMocking', originalMocking)
})

const mockOidcConfig = {
  serverMetadata: () => ({
    supportsPKCE: () => true
  })
}

const mockServer = () => ({
  app: {
    federatedCredentials: {
      getToken: vi.fn().mockResolvedValue('federated-token')
    }
  },
  auth: {
    scheme: vi.fn(),
    strategy: vi.fn()
  }
})

describe('federated-oidc scheme', () => {
  beforeEach(() => {
    discoveryMock.mockResolvedValue(mockOidcConfig)
    buildAuthorizationUrl.mockReturnValue('https://login.example/authorize')
    authorizationCodeGrant.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      id_token: 'id-token',
      expiresIn: () => 3600,
      claims: () => ({
        oid: 'user-1',
        name: 'User One',
        email: 'user@example.com',
        login_hint: 'hint'
      })
    })
    refreshTokenGrant.mockResolvedValue({ access_token: 'new-access' })
    randomPKCECodeVerifier.mockReturnValue('code-verifier')
    calculatePKCECodeChallenge.mockResolvedValue('code-challenge')
  randomNonce.mockReturnValue('nonce')
  allowInsecureRequests.mockClear()
})

  test('pre-login redirects to the authorization URL with PKCE and stores verifier in session', async () => {
    const server = mockServer()
    await federatedOidc.register(server)

    const schemeFn = server.auth.scheme.mock.calls[0][1]
    const strategyOptions = server.auth.strategy.mock.calls[0][2]
    const { authenticate } = schemeFn(server, strategyOptions)

    const flash = vi.fn()
    const set = vi.fn()
    const takeover = vi.fn().mockReturnValue('redirected')
    const request = {
      yar: { flash, set },
      query: {},
      info: { referrer: 'http://localhost/start?x=1' }
    }

    const redirect = vi.fn(() => ({ takeover }))
    const h = { redirect }

    const response = await authenticate(request, h)

    expect(buildAuthorizationUrl).toHaveBeenCalledWith(mockOidcConfig, {
      redirect_uri: strategyOptions.redirectUri,
      scope: strategyOptions.scope,
      code_challenge: 'code-challenge',
      code_challenge_method: 'S256'
    })
    expect(set).toHaveBeenCalledWith('oidc-auth', {
      codeVerifier: 'code-verifier',
      nonce: undefined
    })
    expect(flash).toHaveBeenCalledWith(referrerFlashKey, '/start?x=1')
    expect(redirect).toHaveBeenCalled()
    expect(takeover).toHaveBeenCalled()
    expect(response).toBe('redirected')
  })

  test('post-login authenticates with claims from the token', async () => {
    const server = mockServer()
    await federatedOidc.register(server)

    const schemeFn = server.auth.scheme.mock.calls[0][1]
    const strategyOptions = server.auth.strategy.mock.calls[0][2]
    const { authenticate } = schemeFn(server, strategyOptions)

    const request = {
      yar: {
        get: vi
          .fn()
          .mockReturnValue({ codeVerifier: 'code-verifier', nonce: 'nonce' })
      },
      query: { code: 'abc' },
      url: 'http://localhost/auth/callback?code=abc'
    }

    const authenticated = vi.fn((payload) => payload)
    const h = { authenticated }

    const result = await authenticate(request, h)

    expect(authorizationCodeGrant).toHaveBeenCalled()
    expect(result.credentials.profile).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'User One',
        loginHint: 'hint'
      })
    )
  })

  test('returns unauthorized when pre-login fails', async () => {
    buildAuthorizationUrl.mockImplementationOnce(() => {
      throw new Error('prelogin fail')
    })
    const server = mockServer()
    await federatedOidc.register(server)

    const schemeFn = server.auth.scheme.mock.calls[0][1]
    const strategyOptions = server.auth.strategy.mock.calls[0][2]
    const { authenticate } = schemeFn(server, strategyOptions)

    const h = {
      redirect: vi.fn(() => ({ takeover: () => 'taken' }))
    }

    const result = await authenticate(
      { yar: { flash: vi.fn(), set: vi.fn() }, query: {} },
      h
    )

    expect(result.isBoom).toBe(true)
    expect(result.output.statusCode).toBe(401)
  })

  test('refreshToken calls discovery and refreshTokenGrant with provided options', async () => {
    const options = {
      discoveryUri: 'https://login.example/.well-known/openid-configuration',
      clientId: 'client-id',
      scope: 'api://client-id/cdp.user',
      tokenProvider: vi.fn().mockResolvedValue('federated-token'),
      execute: [vi.fn()]
    }

    const result = await refreshToken(options, 'refresh-token')

    expect(discoveryMock).toHaveBeenCalled()
    expect(refreshTokenGrant).toHaveBeenCalledWith(
      mockOidcConfig,
      'refresh-token',
      {
        scope: options.scope
      }
    )
    expect(result).toEqual({ access_token: 'new-access' })
  })

  test('pre-login falls back to nonce when PKCE is unsupported and defaults referrer safely', async () => {
    discoveryMock.mockResolvedValueOnce({
      serverMetadata: () => ({
        supportsPKCE: () => false
      })
    })

    const server = mockServer()
    await federatedOidc.register(server)

    const schemeFn = server.auth.scheme.mock.calls[0][1]
    const strategyOptions = server.auth.strategy.mock.calls[0][2]
    const { authenticate } = schemeFn(server, strategyOptions)

    const flash = vi.fn()
    const set = vi.fn()
    const takeover = vi.fn().mockReturnValue('redirected')
    const request = {
      yar: { flash, set },
      query: {}
    }

    const redirect = vi.fn(() => ({ takeover }))
    const h = { redirect }

    await authenticate(request, h)

    expect(calculatePKCECodeChallenge).toHaveBeenCalledWith('code-verifier')
    expect(set).toHaveBeenCalledWith('oidc-auth', {
      codeVerifier: 'code-verifier',
      nonce: 'nonce'
    })
    expect(flash).toHaveBeenCalledWith(referrerFlashKey, '/')
  })

  test('post-login returns unauthorized when token exchange fails', async () => {
    authorizationCodeGrant.mockRejectedValueOnce(new Error('no token'))
    const server = mockServer()
    await federatedOidc.register(server)

    const schemeFn = server.auth.scheme.mock.calls[0][1]
    const strategyOptions = server.auth.strategy.mock.calls[0][2]
    const { authenticate } = schemeFn(server, strategyOptions)

    const h = { authenticated: vi.fn() }
    const request = {
      yar: { get: vi.fn().mockReturnValue({ codeVerifier: 'v', nonce: 'n' }) },
      query: { code: 'abc' },
      url: 'http://localhost/auth/callback?code=abc'
    }

    const result = await authenticate(request, h)

    expect(result.isBoom).toBe(true)
    expect(result.output.statusCode).toBe(401)
  })

  test('allows insecure requests when mocks are enabled', async () => {
    config.set('azureFederatedCredentials.enableMocking', true)
    const server = mockServer()
    await federatedOidc.register(server)

    const strategyOptions = server.auth.strategy.mock.calls[0][2]
    expect(strategyOptions.execute).toContain(allowInsecureRequests)
  })

  test('refreshUserSession delegates to refreshTokenIfExpired callback', async () => {
    const refreshTokenSpy = vi.spyOn(
      refreshTokenModule,
      'refreshTokenIfExpired'
    )
    config.set('azureFederatedCredentials.enableMocking', false)
    const server = mockServer()
    await federatedOidc.register(server)

    const expiredSession = { expiresAt: new Date(0).toISOString() }

    const refreshedJwt = jwt.token.generate(
      {
        oid: 'user-123',
        preferred_username: 'user@example.com',
        name: 'User Example',
        login_hint: 'hint'
      },
      { key: 'secret', algorithm: 'HS256' }
    )
    refreshTokenGrant.mockResolvedValueOnce({
      access_token: refreshedJwt,
      refresh_token: 'new-refresh',
      expires_in: 3600
    })

    const set = vi.fn()
    const request = {
      logger: { info: vi.fn(), debug: vi.fn() },
      server: { app: { session: { set } } },
      state: { userSessionCookie: { sessionId: 'session-id' } }
    }

    await server.app.refreshUserSession(request, expiredSession)

    expect(refreshTokenSpy).toHaveBeenCalled()
    const refreshFn = refreshTokenSpy.mock.calls[0][0]
    await refreshFn('refresh-token')
    expect(refreshTokenGrant).toHaveBeenCalledWith(
      mockOidcConfig,
      'refresh-token',
      { scope: server.auth.strategy.mock.calls[0][2].scope }
    )
    expect(set).toHaveBeenCalled()

    refreshTokenSpy.mockRestore()
  })

  test('pre-login ignores callback referrer to avoid redirect loops', async () => {
    const server = mockServer()
    await federatedOidc.register(server)

    const schemeFn = server.auth.scheme.mock.calls[0][1]
    const strategyOptions = server.auth.strategy.mock.calls[0][2]
    const { authenticate } = schemeFn(server, strategyOptions)

    const flash = vi.fn()
    const set = vi.fn()
    const takeover = vi.fn().mockReturnValue('redirected')
    const request = {
      yar: { flash, set },
      query: {},
      info: { referrer: `${config.get('appBaseUrl')}/auth/callback` }
    }

    const redirect = vi.fn(() => ({ takeover }))
    const h = { redirect }

    await authenticate(request, h)

    expect(flash).toHaveBeenCalledWith(referrerFlashKey, '/')
  })

  test('client credential assertion populates request body during refresh', async () => {
    const body = { set: vi.fn() }
    discoveryMock.mockImplementationOnce(
      (_url, _clientId, _opts, clientAuth, _exec) => {
        clientAuth(null, { client_id: 'client-123' }, body)
        return mockOidcConfig
      }
    )

    const options = {
      discoveryUri: 'https://login.example/.well-known/openid-configuration',
      clientId: 'client-id',
      scope: 'api://client-id/cdp.user',
      tokenProvider: vi.fn().mockResolvedValue('federated-token'),
      execute: []
    }

    await refreshToken(options, 'refresh-token')

    expect(body.set).toHaveBeenCalledWith('client_id', 'client-123')
    expect(body.set).toHaveBeenCalledWith(
      'client_assertion',
      'federated-token'
    )
  })

  test('pre-login preserves relative referrers safely', async () => {
    const server = mockServer()
    await federatedOidc.register(server)

    const schemeFn = server.auth.scheme.mock.calls[0][1]
    const strategyOptions = server.auth.strategy.mock.calls[0][2]
    const { authenticate } = schemeFn(server, strategyOptions)

    const flash = vi.fn()
    const set = vi.fn()
    const takeover = vi.fn().mockReturnValue('redirected')
    const request = {
      yar: { flash, set },
      query: {},
      info: { referrer: '/relative/path?x=1' }
    }

    const redirect = vi.fn(() => ({ takeover }))
    const h = { redirect }

    await authenticate(request, h)

    expect(flash).toHaveBeenCalledWith(referrerFlashKey, '/relative/path?x=1')
  })
})
