import { afterEach, describe, expect, test } from 'vitest'

import { config } from './config.js'

const originalConfig = config.getProperties()

afterEach(() => {
  config.load(originalConfig)
  config.validate({ allowed: 'strict' })
})

describe('config validation', () => {
  test('rejects a blank integration bridge base URL', () => {
    config.load({ integrationBridge: { baseUrl: '' } })

    expect(() => config.validate({ allowed: 'strict' })).toThrow(
      /non-empty URL/
    )
  })

  test('rejects an invalid integration bridge base URL', () => {
    config.load({ integrationBridge: { baseUrl: 'not-a-url' } })

    expect(() => config.validate({ allowed: 'strict' })).toThrow(/valid URL/)
  })

  test('coerces AZURE_MOCK_TOKEN_PAYLOAD JSON string to an object', () => {
    config.load({
      azureMockTokenPayload: '{"given_name":"Test","family_name":"User"}'
    })
    config.validate({ allowed: 'strict' })

    expect(config.get('azureMockTokenPayload')).toEqual({
      given_name: 'Test',
      family_name: 'User'
    })
  })

  test('returns null when AZURE_MOCK_TOKEN_PAYLOAD is not set', () => {
    config.load({ azureMockTokenPayload: null })
    config.validate({ allowed: 'strict' })

    expect(config.get('azureMockTokenPayload')).toBeNull()
  })

  test('coerces empty AZURE_MOCK_TOKEN_PAYLOAD string to null', () => {
    config.load({ azureMockTokenPayload: '' })
    config.validate({ allowed: 'strict' })

    expect(config.get('azureMockTokenPayload')).toBeNull()
  })

  test('rejects invalid AZURE_MOCK_TOKEN_PAYLOAD JSON', () => {
    config.load({ azureMockTokenPayload: '{"given_name"' })

    expect(() => config.validate({ allowed: 'strict' })).toThrow(
      /null or a JSON object/
    )
  })
})
