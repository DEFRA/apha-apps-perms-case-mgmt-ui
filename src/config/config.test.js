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
})
