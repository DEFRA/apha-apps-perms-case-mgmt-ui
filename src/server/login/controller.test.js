import { describe, expect, test } from 'vitest'

import { loginController } from './controller.js'

describe('loginController', () => {
  test('uses azure-oidc auth strategy and redirects home', () => {
    const h = { redirect: (path) => path }

    const response = loginController.handler({}, h)

    expect(loginController.options.auth).toBe('azure-oidc')
    expect(response).toBe('/')
  })
})
