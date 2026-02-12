import { describe, expect, test } from 'vitest'
import Joi from 'joi'

import {
  IntegrationBridgeCommand,
  IntegrationBridgeCommandError
} from './command.js'
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

  test('uses validated input when schema passes', () => {
    class TestCommand extends IntegrationBridgeCommand {
      get inputSchema() {
        return Joi.object({
          emailAddress: Joi.string().email().required(),
          enabled: Joi.boolean().default(true)
        })
      }

      resolveRequest() {
        return { path: '/test' }
      }
    }

    const command = new TestCommand({ emailAddress: 'user@example.com' })

    expect(command.input).toEqual({
      emailAddress: 'user@example.com',
      enabled: true
    })
  })

  test('throws when resolveRequest is not implemented', () => {
    const command = new IntegrationBridgeCommand({ ok: true })

    expect(() => command.resolveRequest()).toThrow(
      'resolveRequest must be implemented by command'
    )
  })
})
