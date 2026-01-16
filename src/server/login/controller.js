const loginController = {
  options: {
    auth: 'azure-oidc'
  },
  handler: (_request, h) => h.redirect('/')
}

export { loginController }
