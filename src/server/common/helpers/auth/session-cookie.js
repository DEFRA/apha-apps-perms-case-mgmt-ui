import authCookie from '@hapi/cookie'
import { config } from '../../../../config/config.js'

const sessionCookieConfig = config.get('session.cookie')

const sessionCookie = {
  plugin: {
    name: 'user-session',
    register: async (server) => {
      await server.register(authCookie)

      server.auth.strategy('session', 'cookie', {
        cookie: {
          name: 'userSessionCookie',
          path: '/',
          password: sessionCookieConfig.password,
          isSecure: sessionCookieConfig.secure,
          ttl: sessionCookieConfig.ttl,
          clearInvalid: true
        },
        keepAlive: true,
        appendNext: true,
        redirectTo: '/login',
        requestDecoratorName: 'sessionCookie',
        validate: async (request, session) => {
          const sessionId = session?.sessionId
          const currentUserSession = sessionId
            ? await request.getUserSession(sessionId)
            : null
          if (currentUserSession?.isAuthenticated) {
            const refreshedUserSession =
              await request.refreshToken(currentUserSession)
            const userSession = !refreshedUserSession
              ? currentUserSession
              : refreshedUserSession

            return {
              isValid: true,
              credentials: userSession
            }
          } else {
            return { isValid: false }
          }
        }
      })

      server.auth.default('session')
    }
  }
}

export { sessionCookie }
