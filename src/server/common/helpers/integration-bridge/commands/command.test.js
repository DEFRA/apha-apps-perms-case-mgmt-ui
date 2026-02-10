import { describe, expect, test } from 'vitest'

import { IntegrationBridgeCommandError } from './command.js'
import { FindCaseManagementUserCommand } from './find-case-management-user.js'

describe('IntegrationBridgeCommand', () => {
  test('throws when input schema validation fails during construction', () => {
    expect(
      () => new FindCaseManagementUserCommand({ emailAddress: 'not-an-email' })
    ).toThrow(IntegrationBridgeCommandError)

    try {
      // eslint-disable-next-line no-new
      new FindCaseManagementUserCommand({ emailAddress: 'not-an-email' })
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrationBridgeCommandError)
      expect(error.cause).toBeInstanceOf(Error)
      expect(error.cause?.isJoi).toBe(true)
      expect(error.cause?.message).toContain('emailAddress')
    }
  })
})
