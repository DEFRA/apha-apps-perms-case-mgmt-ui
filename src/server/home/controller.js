import jwt from '@hapi/jwt'

const missingTokenValue = 'Not available in token'

const getTokenClaims = (accessToken) => {
  if (!accessToken) {
    return {}
  }

  try {
    return jwt.token.decode(accessToken)?.decoded?.payload ?? {}
  } catch {
    return {}
  }
}

const getUserDetailsFromToken = (request) => {
  const accessToken = request?.auth?.credentials?.token ?? ''

  if (accessToken) {
    // eslint-disable-next-line no-console -- required to expose the token for debugging on the home page
    console.log('Access token (for debugging):', accessToken)
  }

  const claims = getTokenClaims(accessToken)

  const email =
    claims.email ??
    claims.preferred_username ??
    request?.auth?.credentials?.email ??
    missingTokenValue

  const nameFromParts = [claims.given_name, claims.family_name]
    .filter(Boolean)
    .join(' ')

  const name =
    claims.name ??
    (nameFromParts || request?.auth?.credentials?.displayName) ??
    missingTokenValue

  return { email, name }
}

/**
 * Service home page controller.
 */
export const homeController = {
  handler(request, h) {
    const { email, name } = getUserDetailsFromToken(request)

    return h.view('home/index', {
      pageTitle: 'Case Management Tool',
      heading: 'Case Management Tool',
      userEmail: email,
      userName: name
    })
  }
}
