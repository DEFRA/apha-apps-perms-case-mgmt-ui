/**
 * @typedef {{
 *   method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
 *   path: string
 *   body?: unknown
 * }} IntegrationBridgeRequestConfig
 */

/**
 * @template TInput
 * @template TOutput
 */
export class IntegrationBridgeCommand {
  /**
   * @param {TInput} input
   */
  constructor(input) {
    /** @type {TInput} */
    this.input = input
  }

  /**
   * @returns {import('joi').Schema | null}
   */
  get outputSchema() {
    return null
  }

  /**
   * @returns {IntegrationBridgeRequestConfig}
   */
  resolveRequest() {
    throw new Error('resolveRequest must be implemented by command')
  }
}
