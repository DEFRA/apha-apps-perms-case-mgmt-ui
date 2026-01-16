import { Page } from './page.js'

const pageHeadingAndTitle = 'Case Management Tool'

class LandingPage extends Page {
  pagePath = '/'
  pageHeading = pageHeadingAndTitle
  pageTitle = pageHeadingAndTitle
}

export default new LandingPage()
