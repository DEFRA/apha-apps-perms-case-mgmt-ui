import Joi from 'joi'

import { IntegrationBridgeCommand } from './command.js'

/**
 * @typedef {{ emailAddress: string }} FindCaseManagementUserInput
 * @typedef {{
 *   data: Array<{ id: string, type: string }>,
 *   links?: { self?: string }
 * }} FindCaseManagementUserOutput
 */

export const FindCaseManagementUserOutputSchema = Joi.object({
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

/** @augments {IntegrationBridgeCommand<FindCaseManagementUserInput, FindCaseManagementUserOutput>} */
export class FindCaseManagementUserCommand extends IntegrationBridgeCommand {
  get outputSchema() {
    return FindCaseManagementUserOutputSchema
  }

  /**
   * @returns {import('./command.js').IntegrationBridgeRequestConfig}
   */
  resolveRequest() {
    return {
      method: 'POST',
      path: '/case-management/users/find',
      body: { emailAddress: this.input.emailAddress }
    }
  }
}
