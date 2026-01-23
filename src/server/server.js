import path from 'path'
import hapi from '@hapi/hapi'
import Scooter from '@hapi/scooter'

import { router } from './router.js'
import { config } from '../config/config.js'
import { pulse } from './common/helpers/pulse.js'
import { catchAll } from './common/helpers/errors.js'
import { nunjucksConfig } from '../config/nunjucks/nunjucks.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { sessionCache } from './common/helpers/session-cache/session-cache.js'
import { getCacheEngine } from './common/helpers/session-cache/cache-engine.js'
import { secureContext } from '@defra/hapi-secure-context'
import { contentSecurityPolicy } from './common/helpers/content-security-policy.js'
import { federatedOidc } from './common/helpers/auth/federated-oidc.js'
import { cognitoFederatedCredentials } from './common/helpers/auth/cognito.js'
import { sessionCookie } from './common/helpers/auth/session-cookie.js'
import { setupCaches } from './common/helpers/session-cache/setup-caches.js'
import { mockCognitoFederatedCredentials } from './common/helpers/auth/mock-cognito.js'
import { mockOidcProvider } from './common/helpers/auth/mock-oidc-provider.js'

export async function createServer() {
  setupProxy()
  const server = hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        }
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    },
    cache: [
      {
        name: config.get('session.cache.name'),
        engine: getCacheEngine(config.get('session.cache.engine'))
      }
    ],
    state: {
      strictHeader: false
    }
  })

  setupCaches(server)

  const useOidcMocks = config.get('azureFederatedCredentials.enableMocking')

  let credentialPlugins = [cognitoFederatedCredentials]

  if (useOidcMocks) {
    credentialPlugins = [mockOidcProvider, mockCognitoFederatedCredentials]
  }

  const plugins = [
    requestLogger,
    requestTracing,
    secureContext,
    pulse,
    sessionCache,
    ...credentialPlugins,
    federatedOidc,
    sessionCookie,
    nunjucksConfig,
    Scooter,
    contentSecurityPolicy,
    router // Register all the controllers/routes defined in src/server/router.js
  ]

  await server.register(plugins)

  server.ext('onPreResponse', catchAll)

  return server
}
