import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import hapi from '@hapi/hapi'
import jwt from '@hapi/jwt'

import { config } from '../../../../config/config.js'
import { mockOidcProvider } from './mock-oidc-provider.js'

describe('mock-oidc-provider authorize', () => {
  let server
  const tenantId = config.get('azureTenantId')

  beforeAll(async () => {
    server = hapi.server()
    await server.register(mockOidcProvider.plugin)
  })

  afterAll(async () => {
    await server.stop()
  })

  test('rejects redirect_uri outside the appBaseUrl allowlist', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/oidc/${tenantId}/oauth2/v2.0/authorize?redirect_uri=${encodeURIComponent('http://malicious.example/callback')}`
    })

    expect(res.statusCode).toBe(400)
    expect(res.result).toBe('invalid redirect_uri')
  })

  test('redirects with an authorization code when redirect_uri is allowed', async () => {
    const redirectUri = `${config.get('appBaseUrl')}/callback`

    const res = await server.inject({
      method: 'GET',
      url: `/oidc/${tenantId}/oauth2/v2.0/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=xyz`
    })

    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain(redirectUri)
    expect(res.headers.location).toContain('code=mock-code')
    expect(res.headers.location).toContain('state=xyz')
  })

  test('token endpoint includes standard OIDC name claims', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/oidc/${tenantId}/oauth2/v2.0/token`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: new URLSearchParams({
        client_id: config.get('azureClientId'),
        scope: 'openid profile email'
      }).toString()
    })

    expect(res.statusCode).toBe(200)

    const response = /** @type {{ access_token: string }} */ (res.result)
    const decoded = jwt.token.decode(response.access_token)
    const payload = decoded.decoded.payload

    expect(payload.given_name).toBe('Mock')
    expect(payload.family_name).toBe('User')
  })
})

describe('mock-oidc-provider token payload overrides', () => {
  let server
  const tenantId = config.get('azureTenantId')
  const originalMockPayload = config.get('azureMockTokenPayload')

  beforeAll(async () => {
    config.set('azureMockTokenPayload', {
      given_name: 'Custom',
      family_name: 'Person',
      preferred_username: 'custom.person@defra.gov.uk',
      login_hint: 'custom',
      aud: 'static-aud-that-should-be-overridden',
      iss: 'https://invalid-issuer.example',
      exp: 1
    })

    server = hapi.server()
    await server.register(mockOidcProvider.plugin)
  })

  afterAll(async () => {
    config.set('azureMockTokenPayload', originalMockPayload)
    await server.stop()
  })

  test('uses configured claims but keeps aud, iss and exp dynamic', async () => {
    const dynamicClientId = `${config.get('azureClientId')}-runtime`

    const res = await server.inject({
      method: 'POST',
      url: `/oidc/${tenantId}/oauth2/v2.0/token`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: new URLSearchParams({
        client_id: dynamicClientId,
        scope: 'openid profile email'
      }).toString()
    })

    expect(res.statusCode).toBe(200)

    const response = /** @type {{ access_token: string }} */ (res.result)
    const decoded = jwt.token.decode(response.access_token)
    const payload = decoded.decoded.payload

    expect(payload.given_name).toBe('Custom')
    expect(payload.family_name).toBe('Person')
    expect(payload.preferred_username).toBe('custom.person@defra.gov.uk')
    expect(payload.login_hint).toBe('custom')
    expect(payload.aud).toBe(dynamicClientId)
    expect(payload.iss).toBe(
      `${config.get('appBaseUrl').replace(/\/$/, '')}/oidc/${tenantId}/v2.0`
    )
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })
})
