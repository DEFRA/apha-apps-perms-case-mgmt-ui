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

export class IntegrationBridgeClient {
  /**
   * @param {{
   *   baseUrl: string
   *   middleware: Array<(request: Request) => Promise<Request> | Request>
   *   fetchImpl?: typeof fetch
   * }} options
   */
  constructor({ baseUrl, middleware, fetchImpl = fetch }) {
    if (!baseUrl || !Array.isArray(middleware) || middleware.length === 0) {
      throw new IntegrationBridgeConfigurationError(
        'Integration Bridge requires baseUrl and middleware to be configured'
      )
    }

    this.baseUrl = baseUrl

    this.fetch = fetchImpl

    this.middleware = middleware
  }

  async send(command) {
    if (!command || typeof command.resolveRequest !== 'function') {
      throw new IntegrationBridgeRequestError(
        'Integration Bridge command must implement .resolveRequest'
      )
    }

    const contextLabel = command?.constructor?.name ?? 'command'

    const { method = 'POST', path, body } = command.resolveRequest()

    if (typeof path !== 'string' || !path.trim()) {
      throw new IntegrationBridgeRequestError(
        'Integration Bridge command must provide a valid path'
      )
    }

    if (typeof method !== 'string' || !method.trim()) {
      throw new IntegrationBridgeRequestError(
        'Integration Bridge command must provide a valid method'
      )
    }

    return this.requestJson({
      method,
      path,
      body,
      schema: command.outputSchema,
      contextLabel: path ?? contextLabel
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

    for (const middleware of this.middleware) {
      try {
        request = await middleware(request)
      } catch (error) {
        throw new IntegrationBridgeRequestError(
          `Integration Bridge middleware failed for ${contextLabel ?? path}`,
          { cause: error }
        )
      }

      if (!(request instanceof Request)) {
        throw new IntegrationBridgeRequestError(
          'Integration Bridge middleware must return a Request'
        )
      }
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
      return this.validatePayload(payload, schema, contextLabel ?? path)
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
