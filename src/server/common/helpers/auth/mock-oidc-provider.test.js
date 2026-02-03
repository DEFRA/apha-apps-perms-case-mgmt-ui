import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import hapi from '@hapi/hapi'

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
})
