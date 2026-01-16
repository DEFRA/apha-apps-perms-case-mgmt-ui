import { describe, expect, test } from 'vitest'
import jwt from '@hapi/jwt'

import { tokenHasExpired } from './cognito.js'

describe('cognito tokenHasExpired', () => {
  test('returns false when the token is still valid', () => {
    const token = jwt.token.generate(
      { exp: Math.floor(Date.now() / 1000) + 60 },
      { key: 'secret', algorithm: 'HS256' }
    )

    expect(tokenHasExpired(token)).toBe(false)
  })

  test('returns true when the token has expired', () => {
    const token = jwt.token.generate(
      { exp: Math.floor(Date.now() / 1000) - 60 },
      { key: 'secret', algorithm: 'HS256' }
    )

    expect(tokenHasExpired(token)).toBe(true)
  })
})
