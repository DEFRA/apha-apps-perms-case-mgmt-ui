import { randomUUID } from 'node:crypto'

import Boom from '@hapi/boom'

import { createUserSession } from '../common/helpers/auth/user-session.js'
import { redirectWithRefresh } from '../common/helpers/url/url-helpers.js'
import { referrerFlashKey } from '../common/helpers/auth/federated-oidc.js'
import { integrationClient } from '../common/helpers/integration-bridge/index.js'

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
      await ensureCaseManagementUserExists(request)

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

async function ensureCaseManagementUserExists(request) {
  const emailAddress = request?.auth?.credentials?.profile?.email

  if (!emailAddress) {
    throw Boom.forbidden('Email address missing from authentication token')
  }

  try {
    const response =
      await integrationClient.findCaseManagementUser(emailAddress)

    const foundUsers = Array.isArray(response?.data) && response.data.length > 0

    if (!foundUsers) {
      request.logger.warn({ emailAddress }, 'User not found in Case Management')

      throw Boom.forbidden('You are not authorised to access this service')
    }
  } catch (error) {
    if (Boom.isBoom(error)) {
      throw error
    }

    request.logger.error(
      error,
      'Unable to validate user against the APHA Integration Bridge'
    )

    throw Boom.badImplementation('Unable to verify your access at this time')
  }
}

export { authCallbackController }
