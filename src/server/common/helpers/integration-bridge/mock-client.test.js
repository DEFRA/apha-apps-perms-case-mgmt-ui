import { describe, expect, test } from 'vitest'

import { MockIntegrationBridgeClient, buildAllowlist } from './mock-client.js'
import { IntegrationBridgeRequestError } from './client.js'

describe('MockIntegrationBridgeClient', () => {
  test('allows any user when allowlist is empty', async () => {
    const client = new MockIntegrationBridgeClient('')

    const result = await client.findCaseManagementUser('user@example.com')

    expect(result.data[0].id).toBe('mock-user@example.com')
  })

  test('allows only users on the allowlist when provided', async () => {
    const client = new MockIntegrationBridgeClient(
      'one@example.com,two@example.com'
    )

    const allowed = await client.findCaseManagementUser('two@example.com')
    const denied = await client.findCaseManagementUser('three@example.com')

    expect(allowed.data).toHaveLength(1)
    expect(denied.data).toHaveLength(0)
  })

  test('throws when email is missing', async () => {
    const client = new MockIntegrationBridgeClient('')

    // @ts-expect-error intentionally calling without an email to assert error handling
    await expect(client.findCaseManagementUser()).rejects.toBeInstanceOf(
      IntegrationBridgeRequestError
    )
  })
})

describe('buildAllowlist', () => {
  test('splits and normalises addresses', () => {
    const list = buildAllowlist('One@example.com, two@example.com , ')

    expect(list.has('one@example.com')).toBe(true)
    expect(list.has('two@example.com')).toBe(true)
    expect(list.size).toBe(2)
  })
})
