import { randomUUID } from 'node:crypto'

import jwt from '@hapi/jwt'

import { config } from '../../../../config/config.js'

const tenantId = config.get('azureTenantId')
const signingKeyId = 'mock-key'

// Static RSA key pair for mock signing (non-production only)
const rsaPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCoHeDqcx3AHy+m
aGBdjrKsUrdOhwIXfviWjv5SG0jT61XTHdMOHSFViSz+P+ZyZXgOzymzxpCQdIu1
KCwkKhBN6Guzy2rsgUpHl/7W4bYJ5DxLvBwKBHSJk8qjW1L7s8uB02rlR1rw8sq0
beXEeSa5NrRqCCB/mKtjTQWc+BY97bXEsTFMARUnIvkSxwy66XzDMQYdwofPdkBt
XCaygi99BIQrACxKjA0TdJv2S4OV/Ka67i1SGgQaigK2EWDr+UMGGNr2zEMGrOKl
bryrdj7RGV59qBrBHzoe07+anD9Un30jC437EwATSDmWIvUXbyuwB0x0ZKJTYXKV
/d29XDwHAgMBAAECggEACU5iHB2pjhrhLIvcQxbk8soUu0RDoYurSiD57g9JmEWP
jNi6oq41IVgvGpdB8/TZplmMZuxn0JSgWTOzQdXm7NEgCSYKXLOJf5i9MtBFdJsN
mr771F12cAPeNJhtFGGEXe2XSMA1m19CnlCeZqJdj496LDZtSh2S5d57yuUmzLW2
x0+6B4lhCgmqmBp5rqEflFsOH4Tieeb/nm+KQyD7GUnpdSS8W0qARWDsqtVDZ7g5
YRr4OZfvHlZd696nAdINl8qzt4P9G/x25imDbhjVhAYOfmnhpkKnUShcUeIloXmw
NWJKbV2UK9lEdmyFL+85k7zg0h1+xv7YnuStHIA3+QKBgQDYFfzQK4r17xD4IbU5
GI3NHaMWWLulqXqWzfvO5Hjn9nZ+e4z5EyMK62eKQIqOf3YqWGws9sUytNFHQeYm
iomG/vm5juIO2xe6PCFJoeenxIPCMybUKoYxMBnxhF7SAIlycdJecDORk9w8jNtl
YIAhkw8LbxGROT+vyNfQuSR76QKBgQDHK5TrHGMHU6KbTuq5mZMfxt0Wz4diMVuP
RV7b4TyHeWfCIG9vwoFBTC222bY28EgNSpjFT/6MY3zx6eb58cYl6RxFoD829ZhF
VZLqJOfxCsGhYre/dP+80UCNL0UABowexluZiFsDR02Tg/h/Iodjwe59AID0KLrw
UqA8GD8ybwKBgQC0E97UPPVZbxndL3ovUt8ZiRFYlioLLOoUsySejpiT9zlYvu4E
xIX3m6Z1+MN/bYm0UGwWLLC6SSX/FFQQ2nMyJVtH4GNTrhJgCaxUCLFdhs+nD6nU
NnwOkd+M/ptmtzvUPDbsrOTM9UQc0eYk3f7p+/wVs0IYnHUOsXnpX+GfwQKBgB4y
9HyFrFpDCyfDWoHT0GQEEifQRbXUyA48NXrfdv8PoHTl2B+4/UI6W8Aa2K8R1cr2
IZ3hWDZPK3W+wn/pceLzqo7AEnWx3Wm95O3NtMFuoRdoUXYdNl2Z2NDPdwXe+EX+
S4tHCo2/tPqGCxqz0JWGpTOc7PCYcGfaD2OtRX/PAoGBAJdNm6qSVU1ehMKXAEII
nAB784iV6+L5XhOssTe9IvF2viDsypvgIdnA6z/dXhfJCEQs3e3cMvhnm6SbMBWt
SlJCP4bLEzRD9rLCJC0nqeri30xeSp9ouRP1nBzxYWLQ1peCCRg3GTPRJwhQlNGy
Xnwkn11qaLHMw+XcLtN0FUbo
-----END PRIVATE KEY-----`

const rsaJwk = {
  kty: 'RSA',
  kid: signingKeyId,
  use: 'sig',
  alg: 'RS256',
  n: 'qB3g6nMdwB8vpmhgXY6yrFK3TocCF374lo7-UhtI0-tV0x3TDh0hVYks_j_mcmV4Ds8ps8aQkHSLtSgsJCoQTehrs8tq7IFKR5f-1uG2CeQ8S7wcCgR0iZPKo1tS-7PLgdNq5Uda8PLKtG3lxHkmuTa0agggf5irY00FnPgWPe21xLExTAEVJyL5EscMuul8wzEGHcKHz3ZAbVwmsoIvfQSEKwAsSowNE3Sb9kuDlfymuu4tUhoEGooCthFg6_lDBhja9sxDBqzipW68q3Y-0RlefagawR86HtO_mpw_VJ99IwuN-xMAE0g5liL1F28rsAdMdGSiU2Fylf3dvVw8Bw',
  e: 'AQAB'
}

function buildBaseUrl() {
  const appBase = config.get('appBaseUrl').replace(/\/$/, '')
  return `${appBase}/oidc/${tenantId}`
}

function buildWellKnown() {
  const base = buildBaseUrl()
  const issuer = `${base}/v2.0`
  return {
    issuer,
    authorization_endpoint: `${base}/oauth2/v2.0/authorize`,
    token_endpoint: `${base}/oauth2/v2.0/token`,
    end_session_endpoint: `${base}/oauth2/v2.0/logout`,
    jwks_uri: `${base}/discovery/v2.0/keys`,
    response_types_supported: ['code'],
    subject_types_supported: ['pairwise'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: [
      'client_secret_post',
      'client_secret_basic'
    ]
  }
}

const mockOidcProvider = {
  plugin: {
    version: '0.0.0',
    name: 'mock-oidc-provider',
    register: async (server) => {
      const wellKnown = buildWellKnown()

      server.route({
        method: 'GET',
        path: `/oidc/${tenantId}/v2.0/.well-known/openid-configuration`,
        options: { auth: false },
        handler: () => wellKnown
      })

      server.route({
        method: 'GET',
        path: `/oidc/${tenantId}/oauth2/v2.0/authorize`,
        options: { auth: false },
        handler: (request, h) => {
          const { redirect_uri: redirectUri, state } = request.query
          if (!redirectUri) {
            return h.response('missing redirect_uri').code(400)
          }
          const params = new URLSearchParams({ code: 'mock-code' })
          if (state) {
            params.append('state', state)
          }
          return h.redirect(`${redirectUri}?${params.toString()}`)
        }
      })

      server.route({
        method: 'POST',
        path: `/oidc/${tenantId}/oauth2/v2.0/token`,
        options: {
          auth: false,
          payload: {
            output: 'data',
            parse: true,
            allow: 'application/x-www-form-urlencoded'
          }
        },
        handler: (request, h) => {
          const clientId = request.payload?.client_id ?? config.get('azureClientId')
          const payload = {
            oid: 'mock-user',
            sub: 'mock-user',
            preferred_username: 'mock.user@example.com',
            name: 'Mock User',
            login_hint: 'mock',
            aud: clientId,
            iss: buildBaseUrl() + '/v2.0',
            exp: Math.floor(Date.now() / 1000) + 3600
          }
          const accessToken = jwt.token.generate(payload, {
            key: rsaPrivateKey,
            algorithm: 'RS256'
          })
          const idToken = jwt.token.generate(
            { ...payload, nonce: request.payload?.nonce },
            {
              key: rsaPrivateKey,
              algorithm: 'RS256'
            }
          )
          return h.response({
            token_type: 'Bearer',
            scope: request.payload?.scope ?? '',
            expires_in: 3600,
            ext_expires_in: '0',
            access_token: accessToken,
            refresh_token: `refresh-${randomUUID()}`,
            id_token: idToken
          })
        }
      })

      server.route({
        method: 'GET',
        path: `/oidc/${tenantId}/discovery/v2.0/keys`,
        options: { auth: false },
        handler: () => ({ keys: [rsaJwk] })
      })

      server.route({
        method: 'GET',
        path: `/oidc/${tenantId}/oauth2/v2.0/logout`,
        options: { auth: false },
        handler: (request, h) => {
          const redirect = request.query?.post_logout_redirect_uri
          if (redirect) {
            return h.redirect(redirect)
          }
          return h.response({ logout: 'ok' })
        }
      })
    }
  }
}

export { mockOidcProvider }
