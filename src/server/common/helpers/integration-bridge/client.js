export class IntegrationBridgeConfigurationError extends Error {
  constructor(message) {
    super(message)

    this.name = 'IntegrationBridgeConfigurationError'
  }
}

export class IntegrationBridgeRequestError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, payload?: unknown, cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message, options?.cause ? { cause: options.cause } : undefined)

    this.name = 'IntegrationBridgeRequestError'

    this.status = options.status

    this.payload = options.payload
  }
}

/**
 * @typedef {'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'} IntegrationBridgeMethod
 *
 * @typedef {{
 *   method?: IntegrationBridgeMethod
 *   path: string
 *   body?: unknown
 * }} IntegrationBridgeRequestConfig
 *
 * @typedef {{
 *   resolveRequest: () => IntegrationBridgeRequestConfig
 *   outputSchema?: import('joi').Schema | null
 * }} IntegrationBridgeCommand
 *
 * @typedef {(request: Request) => Promise<Request> | Request} IntegrationBridgeMiddleware
 */

const identityMiddleware = (request) => request

export class IntegrationBridgeClient {
  /**
   * @param {{
   *   baseUrl: string
   *   middleware?: IntegrationBridgeMiddleware
   *   fetchImpl?: typeof fetch
   * }} options
   */
  constructor({ baseUrl, middleware = identityMiddleware, fetchImpl = fetch }) {
    if (!baseUrl) {
      throw new IntegrationBridgeConfigurationError(
        'Integration Bridge requires baseUrl to be configured'
      )
    }

    this.baseUrl = baseUrl

    this.fetch = fetchImpl

    this.middleware = middleware
  }

  /**
   * @param {IntegrationBridgeCommand} command
   */
  async send(command) {
    const contextLabel = command.constructor.name

    const { method = 'POST', path, body } = command.resolveRequest()

    return this.requestJson({
      method,
      path,
      body,
      schema: command.outputSchema,
      contextLabel
    })
  }

  async requestJson({ method, path, body, schema, contextLabel }) {
    const url = new URL(path, this.baseUrl)

    let request = new Request(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })

    try {
      request = await this.middleware(request)
    } catch (error) {
      throw new IntegrationBridgeRequestError(
        `Integration Bridge middleware failed for ${contextLabel}`,
        { cause: error }
      )
    }

    const response = await this.safeFetch(request)

    const payload = await this.readPayload(response)

    if (!response.ok) {
      throw new IntegrationBridgeRequestError(
        `Integration Bridge responded with ${response.status}`,
        { status: response.status, payload }
      )
    }

    if (schema) {
      return this.validatePayload(payload, schema, contextLabel)
    }

    return payload
  }

  async safeFetch(request) {
    try {
      return await this.fetch(request)
    } catch (error) {
      throw new IntegrationBridgeRequestError(
        'Failed to communicate with the APHA Integration Bridge',
        { cause: error }
      )
    }
  }

  validatePayload(payload, schema, contextLabel) {
    const { error, value } = schema.validate(payload, {
      abortEarly: false
    })

    if (error) {
      throw new IntegrationBridgeRequestError(
        `Integration Bridge payload validation failed for ${contextLabel}`,
        { payload, cause: error }
      )
    }

    return value
  }

  async readPayload(response) {
    const text = await response.text()

    if (!text) {
      return null
    }

    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
}
