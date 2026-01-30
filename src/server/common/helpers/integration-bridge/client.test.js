import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import {
  IntegrationBridgeClient,
  IntegrationBridgeConfigurationError,
  IntegrationBridgeRequestError
} from './client.js'

const { Response } = globalThis

const baseUrl = 'https://bridge.example'

const tokenUrl = `${baseUrl}/oauth2/token`

const findUrl = `${baseUrl}/case-management/users/find`

const tokenResponse = { access_token: 'token-123', expires_in: 3600 }

const server = setupServer()

beforeAll(() => server.listen())

afterAll(() => server.close())

afterEach(() => server.resetHandlers())

describe('IntegrationBridgeClient', () => {
  test('fetches a token and posts to the case management find endpoint', async () => {
    let tokenCalls = 0
    let findCalls = 0
    server.use(
      http.post(tokenUrl, async ({ request }) => {
        tokenCalls += 1
        const body = await request.formData()
        expect(body.get('grant_type')).toBe('client_credentials')
        expect(body.get('client_id')).toBe('client-id')
        expect(body.get('client_secret')).toBe('client-secret')
        expect(request.headers.get('authorization')).toContain('Basic ')
        return HttpResponse.json(tokenResponse)
      }),
      http.post(findUrl, async ({ request }) => {
        findCalls += 1
        expect(request.headers.get('authorization')).toBe(
          `Bearer ${tokenResponse.access_token}`
        )
        const payload = await request.json()
        expect(payload).toEqual({ emailAddress: 'user@example.com' })
        return HttpResponse.json({
          data: [{ id: 'case-user', type: 'case-management-user' }]
        })
      })
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    const result = await client.findCaseManagementUser('user@example.com')

    expect(result?.data?.[0]?.id).toBe('case-user')
    expect(tokenCalls).toBe(1)
    expect(findCalls).toBe(1)
  })

  test('reuses a cached access token when it is still valid', async () => {
    let tokenCalls = 0
    let findCalls = 0
    server.use(
      http.post(tokenUrl, () => {
        tokenCalls += 1
        return HttpResponse.json(tokenResponse)
      }),
      http.post(findUrl, () => {
        findCalls += 1
        return HttpResponse.json({ data: [] })
      })
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    await client.findCaseManagementUser('user@example.com')
    await client.findCaseManagementUser('user@example.com')

    expect(tokenCalls).toBe(1)
    expect(findCalls).toBe(2)
  })

  test('refreshes an expired token only once when concurrent requests happen', async () => {
    vi.useFakeTimers()
    let tokenCalls = 0
    const authHeaders = []

    server.use(
      http.post(tokenUrl, () => {
        tokenCalls += 1
        return HttpResponse.json({
          access_token: `token-${tokenCalls}`,
          expires_in: tokenCalls === 1 ? 1 : 3600
        })
      }),
      http.post(`${baseUrl}/foo`, ({ request }) => {
        authHeaders.push(request.headers.get('authorization'))
        return HttpResponse.json({ ok: true })
      }),
      http.post(`${baseUrl}/bar`, ({ request }) => {
        authHeaders.push(request.headers.get('authorization'))
        return HttpResponse.json({ ok: true })
      })
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      tokenBufferSeconds: 0
    })

    // Seed an expired token to force a refresh
    client.authorization = Promise.resolve({
      accessToken: 'stale-token',
      expiresAt: new Date(Date.now() - 1000)
    })

    const requests = Promise.all([
      client.postJson('/foo', {}, null, 'foo'),
      client.postJson('/bar', {}, null, 'bar')
    ])

    vi.advanceTimersByTime(2000)
    await requests

    expect(tokenCalls).toBe(1)
    expect(authHeaders).toEqual(['Bearer token-1', 'Bearer token-1'])
    vi.useRealTimers()
  })

  test('throws a request error when the bridge responds with a non-200 status', async () => {
    server.use(
      http.post(tokenUrl, () => HttpResponse.json(tokenResponse)),
      http.post(findUrl, () =>
        HttpResponse.json({ message: 'oops' }, { status: 500 })
      )
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    await expect(
      client.findCaseManagementUser('user@example.com')
    ).rejects.toBeInstanceOf(IntegrationBridgeRequestError)
  })

  test('throws a configuration error when baseUrl is not provided', async () => {
    expect(
      () =>
        new IntegrationBridgeClient({
          // @ts-expect-error intentional for test
          baseUrl: null,
          tokenUrl,
          clientId: 'client-id',
          clientSecret: 'client-secret'
        })
    ).toThrow(IntegrationBridgeConfigurationError)
  })

  test('throws when token response is missing required fields', async () => {
    server.use(
      http.post(tokenUrl, () =>
        HttpResponse.json({ expires_in: 3600 }, { status: 200 })
      )
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    await expect(
      client.findCaseManagementUser('user@example.com')
    ).rejects.toBeInstanceOf(IntegrationBridgeRequestError)
  })

  test('throws when find response does not match expected shape', async () => {
    server.use(
      http.post(tokenUrl, () => HttpResponse.json(tokenResponse)),
      http.post(findUrl, () =>
        HttpResponse.json({ links: { self: 'case-management/users/find' } })
      )
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    await expect(
      client.findCaseManagementUser('user@example.com')
    ).rejects.toBeInstanceOf(IntegrationBridgeRequestError)
  })

  test('forwards the user access token via X-Forwarded-Authorization when provided', async () => {
    let forwardedHeader

    server.use(
      http.post(tokenUrl, () => HttpResponse.json(tokenResponse)),
      http.post(`${baseUrl}/example`, async ({ request }) => {
        forwardedHeader = request.headers.get('x-forwarded-authorization')
        return HttpResponse.json({ ok: true })
      })
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    await client.postJson(
      '/example',
      { foo: 'bar' },
      null,
      'example',
      'user-token-456'
    )

    expect(forwardedHeader).toBe('Bearer user-token-456')
  })

  test('does not add forwarded auth header when token is missing or blank', async () => {
    let forwardedHeader

    server.use(
      http.post(tokenUrl, () => HttpResponse.json(tokenResponse)),
      http.post(`${baseUrl}/no-forward`, async ({ request }) => {
        forwardedHeader = request.headers.get('x-forwarded-authorization')
        return HttpResponse.json({ ok: true })
      })
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    await client.postJson('/no-forward', { foo: 'bar' }, null, 'no-forward')
    expect(forwardedHeader).toBeNull()

    await client.postJson(
      '/no-forward',
      { foo: 'bar' },
      null,
      'no-forward',
      '   '
    )
    expect(forwardedHeader).toBeNull()
  })

  test('normalises forwarded tokens that already include the Bearer prefix', () => {
    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    expect(client.formatForwardedAuthorization('  Bearer xyz  ')).toBe(
      'Bearer xyz'
    )
    expect(client.formatForwardedAuthorization('abc123')).toBe('Bearer abc123')
  })

  test('wraps fetch errors with IntegrationBridgeRequestError', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('network down'))
    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: failingFetch
    })

    await expect(client.safeFetch('http://example.com', {})).rejects.toThrow(
      'Failed to communicate with the APHA Integration Bridge'
    )
  })

  test('parses payloads defensively', async () => {
    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    const empty = await client.readPayload(new Response(''))
    expect(empty).toBeNull()

    const text = await client.readPayload(new Response('not-json'))
    expect(text).toBe('not-json')
  })

  test('calculateExpiry returns immediate expiry when expiresIn is invalid', () => {
    const client = new IntegrationBridgeClient({
      baseUrl,
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    const now = Date.now()
    const expires = client.calculateExpiry(undefined)

    expect(expires.getTime()).toBeGreaterThanOrEqual(now)
  })
})
