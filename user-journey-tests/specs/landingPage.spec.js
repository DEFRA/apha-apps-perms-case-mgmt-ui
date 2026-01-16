import landingPage from '../page-objects/landingPage.js'

describe('Landing page test', () => {
  it('should navigate to home page', async () => {
    await landingPage.navigateToPageAndVerifyTitle()
  })
})
