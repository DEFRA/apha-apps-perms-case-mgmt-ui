import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

import { config } from '../../../../config/config.js'
import { fetchWellknown } from './fetch-well-known.js'

const mockWellKnownUrl =
  'http://localhost:9999/.well-known/openid-configuration'

const mswServer = setupServer(
  http.get(mockWellKnownUrl, () =>
    HttpResponse.json({
      authorization_endpoint: 'https://auth.example/authorize',
      token_endpoint: 'https://auth.example/token',
      end_session_endpoint: 'https://auth.example/logout'
    })
  )
)

describe('fetch-well-known', () => {
  beforeAll(() => {
    mswServer.listen()
  })

  afterAll(() => {
    mswServer.close()
  })

  beforeEach(() => {
    mswServer.resetHandlers()
    config.set('oidcWellKnownConfigurationUrl', mockWellKnownUrl)
    config.set('azureFederatedCredentials.enableMocking', false)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns well-known payload when the endpoint responds successfully', async () => {
    const payload = await fetchWellknown()

    expect(payload.authorization_endpoint).toBe(
      'https://auth.example/authorize'
    )
    expect(payload.token_endpoint).toBe('https://auth.example/token')
    expect(payload.end_session_endpoint).toBe('https://auth.example/logout')
  })

  test('throws an error when the endpoint responds with a non-200 status', async () => {
    mswServer.use(
      http.get(mockWellKnownUrl, () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    )

    await expect(fetchWellknown()).rejects.toThrow(
      /Failed to fetch well-known configuration/
    )
  })

  test('returns static mock payload when mocking is enabled', async () => {
    config.set('azureFederatedCredentials.enableMocking', true)
    const payload = await fetchWellknown()

    expect(payload.authorization_endpoint).toContain(
      config.get('azureTenantId')
    )
    expect(payload.end_session_endpoint).toContain('logout')
  })
})
