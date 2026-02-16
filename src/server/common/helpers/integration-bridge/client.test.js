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
import { IntegrationBridgeCommand } from './commands/command.js'
import { FindCaseManagementUserCommand } from './commands/find-case-management-user.js'

const { Response } = globalThis

const baseUrl = 'https://bridge.example'

const findUrl = `${baseUrl}/case-management/users/find`

const server = setupServer()

beforeAll(() => server.listen())

afterAll(() => server.close())

afterEach(() => server.resetHandlers())

const noopMiddleware = async (request) => request

const authMiddleware = async (request) => {
  const headers = new Headers(request.headers)
  headers.set('Authorization', 'Bearer token-123')
  return new Request(request, { headers })
}

class TestPostCommand extends IntegrationBridgeCommand {
  /**
   * @param {{ path: string, body: unknown }} input
   */
  constructor({ path, body }) {
    super(body)
    this.path = path
  }

  /**
   * @returns {import('./commands/command.js').IntegrationBridgeRequestConfig}
   */
  resolveRequest() {
    return {
      method: 'POST',
      path: this.path,
      body: this.input
    }
  }
}

describe('IntegrationBridgeClient', () => {
  test('sends a FindCaseManagementUserCommand via send()', async () => {
    server.use(
      http.post(findUrl, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer token-123')
        const payload = await request.json()
        expect(payload).toEqual({ emailAddress: 'user@example.com' })
        return HttpResponse.json({
          data: [{ id: 'case-user', type: 'case-management-user' }]
        })
      })
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      middleware: authMiddleware
    })

    const result = await client.send(
      new FindCaseManagementUserCommand({ emailAddress: 'user@example.com' })
    )

    expect(result?.data?.[0]?.id).toBe('case-user')
  })

  test('applies request middleware before fetching', async () => {
    server.use(
      http.post(`${baseUrl}/ordered`, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer token-123')
        return HttpResponse.json({ ok: true })
      })
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      middleware: authMiddleware
    })

    const result = await client.send(
      new TestPostCommand({ path: '/ordered', body: { ok: true } })
    )

    expect(result).toEqual({ ok: true })
  })

  test('throws a request error when the bridge responds with a non-200 status', async () => {
    server.use(
      http.post(findUrl, () =>
        HttpResponse.json({ message: 'oops' }, { status: 500 })
      )
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      middleware: authMiddleware
    })

    await expect(
      client.send(
        new FindCaseManagementUserCommand({ emailAddress: 'user@example.com' })
      )
    ).rejects.toBeInstanceOf(IntegrationBridgeRequestError)
  })

  test('throws a configuration error when baseUrl is not provided', () => {
    expect(
      () =>
        new IntegrationBridgeClient({
          // @ts-expect-error intentional for test
          baseUrl: null,
          middleware: noopMiddleware
        })
    ).toThrow(IntegrationBridgeConfigurationError)
  })

  test('throws when middleware throws an error', async () => {
    const client = new IntegrationBridgeClient({
      baseUrl,
      middleware: async () => {
        throw new Error('middleware boom')
      }
    })

    await expect(
      client.send(new TestPostCommand({ path: '/foo', body: {} }))
    ).rejects.toBeInstanceOf(IntegrationBridgeRequestError)
  })

  test('throws when find response does not match expected shape', async () => {
    server.use(
      http.post(findUrl, () =>
        HttpResponse.json({ links: { self: 'case-management/users/find' } })
      )
    )

    const client = new IntegrationBridgeClient({
      baseUrl,
      middleware: authMiddleware
    })

    await expect(
      client.send(
        new FindCaseManagementUserCommand({ emailAddress: 'user@example.com' })
      )
    ).rejects.toBeInstanceOf(IntegrationBridgeRequestError)
  })

  test('wraps fetch errors with IntegrationBridgeRequestError', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('network down'))
    const client = new IntegrationBridgeClient({
      baseUrl,
      middleware: noopMiddleware,
      fetchImpl: failingFetch
    })

    await expect(
      client.safeFetch(new Request('http://example.com'))
    ).rejects.toThrow('Failed to communicate with the APHA Integration Bridge')
  })

  test('parses payloads defensively', async () => {
    const client = new IntegrationBridgeClient({
      baseUrl,
      middleware: noopMiddleware
    })

    const empty = await client.readPayload(new Response(''))
    expect(empty).toBeNull()

    const text = await client.readPayload(new Response('not-json'))
    expect(text).toBe('not-json')
  })
})
