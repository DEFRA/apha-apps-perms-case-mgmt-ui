/**
 * @typedef {{ method?: string, path: string, body?: unknown }} IntegrationBridgeRequestConfig
 */

class IntegrationBridgeCommandError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message, options?.cause ? { cause: options.cause } : undefined)

    this.name = 'IntegrationBridgeCommandError'
  }
}

/**
 * @template TInput
 * @template TOutput
 */
class IntegrationBridgeCommand {
  /**
   * @param {TInput} input
   */
  constructor(input) {
    /** @type {TInput} */
    this.input = input

    /** @type {import('joi').Schema | null} */
    const schema = this.inputSchema

    if (schema && typeof schema.validate === 'function') {
      const { error, value } = schema.validate(input, {
        abortEarly: false
      })

      if (error) {
        throw new IntegrationBridgeCommandError(
          'Integration Bridge command input validation failed',
          { cause: error }
        )
      }

      this.input = value
    }
  }

  /**
   * @returns {import('joi').Schema | null}
   */
  get inputSchema() {
    return null
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

export { IntegrationBridgeCommand, IntegrationBridgeCommandError }
