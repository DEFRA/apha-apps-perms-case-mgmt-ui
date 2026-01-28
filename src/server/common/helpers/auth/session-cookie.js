import authCookie from '@hapi/cookie'
import { config } from '../../../../config/config.js'
import { getUserSession } from './get-user-session.js'

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
        redirectTo: '/auth/login',
        requestDecoratorName: 'sessionCookie',
        validate: async (request, session) => {
          const sessionId = session?.sessionId

          const currentUserSession = sessionId
            ? await getUserSession(request, sessionId)
            : null

          if (!currentUserSession?.isAuthenticated) {
            return { isValid: false }
          }

          const refreshedUserSession = server.app.refreshUserSession
            ? await server.app.refreshUserSession(request, currentUserSession)
            : null

          const userSession = refreshedUserSession ?? currentUserSession

          return {
            isValid: true,
            credentials: userSession
          }
        }
      })

      server.auth.default('session')
    }
  }
}

export { sessionCookie }
