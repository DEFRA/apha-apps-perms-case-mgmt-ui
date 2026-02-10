import Joi from 'joi'

import { IntegrationBridgeCommand } from './command.js'

/**
 * @typedef {{ emailAddress: string }} FindCaseManagementUserInput
 * @typedef {{
 *   data: Array<{ id: string, type: string }>,
 *   links?: { self?: string }
 * }} FindCaseManagementUserOutput
 */

const FindCaseManagementUserInputSchema = Joi.object({
  emailAddress: Joi.string().email().required()
}).required()

const FindCaseManagementUserOutputSchema = Joi.object({
  data: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        type: Joi.string().required()
      }).unknown(true)
    )
    .required(),
  links: Joi.object({
    self: Joi.string()
  })
    .unknown(true)
    .optional()
}).unknown(true)

/** @extends {IntegrationBridgeCommand<FindCaseManagementUserInput, FindCaseManagementUserOutput>} */
class FindCaseManagementUserCommand extends IntegrationBridgeCommand {
  get inputSchema() {
    return FindCaseManagementUserInputSchema
  }

  get outputSchema() {
    return FindCaseManagementUserOutputSchema
  }

  resolveRequest() {
    return {
      method: 'POST',
      path: '/case-management/users/find',
      body: { emailAddress: this.input.emailAddress }
    }
  }
}

export {
  FindCaseManagementUserCommand,
  FindCaseManagementUserInputSchema,
  FindCaseManagementUserOutputSchema
}
