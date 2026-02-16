import { describe, expect, test } from 'vitest'

import { IntegrationBridgeCommand } from './command.js'

describe('IntegrationBridgeCommand', () => {
  test('stores constructor input', () => {
    const payload = { emailAddress: 'user@example.com' }
    const command = new IntegrationBridgeCommand(payload)

    expect(command.input).toBe(payload)
  })

  test('throws when resolveRequest is not implemented', () => {
    const command = new IntegrationBridgeCommand({ ok: true })

    expect(() => command.resolveRequest()).toThrow(
      'resolveRequest must be implemented by command'
    )
  })
})
