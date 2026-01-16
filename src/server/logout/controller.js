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
    const referrer = request.info.referrer
    const loginHint = userSession?.loginHint

    const logoutUrl = encodeURI(
      `${logoutBaseUrl}?logout_hint=${loginHint}&post_logout_redirect_uri=${referrer}`
    )

    removeAuthenticatedUser(request)

    return h.redirect(logoutUrl)
  }
}

export { logoutController }
