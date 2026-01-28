import { loginController } from './controller.js'

const login = {
  plugin: {
    name: 'login',
    register: (server) => {
      server.route([
        {
          method: 'GET',
          path: '/auth/login',
          ...loginController
        }
      ])
    }
  }
}

export { login }
