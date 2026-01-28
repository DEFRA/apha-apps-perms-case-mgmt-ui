import { randomUUID } from 'node:crypto'

import Boom from '@hapi/boom'

import { createUserSession } from '../common/helpers/auth/user-session.js'
import { redirectWithRefresh } from '../common/helpers/url/url-helpers.js'
import { referrerFlashKey } from '../common/helpers/auth/federated-oidc.js'

const authCallbackController = {
  options: {
    auth: 'azure-oidc',
    response: {
      failAction: () => Boom.boomify(Boom.unauthorized())
    }
  },
  handler: async (request, h) => {
    const { auth, sessionCookie, yar, logger } = request

    if (auth.isAuthenticated) {
      const sessionId = randomUUID()

      logger.info('Creating user session')

      await createUserSession(request, sessionId)

      sessionCookie.set({ sessionId })
    }

    const redirect = yar.flash(referrerFlashKey)?.at(0) ?? '/'

    logger.info(`Login complete, redirecting user to ${redirect}`)

    return redirectWithRefresh(h, redirect)
  }
}

export { authCallbackController }
