import { config } from '../../config/config.js'
import { removeAuthenticatedUser } from '../common/helpers/auth/user-session.js'
import { fetchWellknown } from '../common/helpers/auth/fetch-well-known.js'

const logoutController = {
  handler: async (request, h) => {
    const userSession = request.auth.credentials

    if (!userSession) {
      return h.redirect('/')
    }

    const payload = await fetchWellknown()

    const logoutBaseUrl = payload.end_session_endpoint

    const referrer = request.info.referrer ?? ''

    const loginHint = userSession?.loginHint ?? ''

    const appBaseUrl = config.get('appBaseUrl')

    const redirectUri = buildSafeRedirectUrl(referrer, appBaseUrl)

    const logoutUrl = `${logoutBaseUrl}?logout_hint=${encodeURIComponent(
      loginHint
    )}&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`

    removeAuthenticatedUser(request)

    return h.redirect(logoutUrl)
  }
}

function buildSafeRedirectUrl(referrer, appBaseUrl) {
  try {
    if (referrer) {
      const referrerUrl = new URL(referrer)

      const appUrl = new URL(appBaseUrl)

      const sameHost =
        referrerUrl.protocol === appUrl.protocol &&
        referrerUrl.hostname === appUrl.hostname &&
        referrerUrl.port === appUrl.port

      if (sameHost) {
        return referrerUrl.href
      }
    }
  } catch {
    // fall back to app base URL
  }

  return appBaseUrl
}

export { logoutController }
