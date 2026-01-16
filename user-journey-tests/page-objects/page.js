import { browser, $ } from '@wdio/globals'
import * as page from '../helpers/page.js'

class Page {
  get pagePath() {
    throw new Error('Page path not provided')
  }

  get pageHeading() {
    throw new Error('Page heading not provided')
  }

  get pageTitle() {
    throw new Error('Page title not provided')
  }

  getPageHeading() {
    return $('h1')
  }

  getPageTitle() {
    return browser.getTitle()
  }

  async navigateToPageAndVerifyTitle(preview = true) {
    await page.loadPageAndVerifyTitle(this.pagePath, this.pageTitle, preview)
  }

  async verifyPageHeadingAndTitle() {
    await page.validateElementVisibleAndText(
      this.getPageHeading(),
      this.pageHeading
    )
    await page.verifyPageTitle(this.pageTitle)
  }
}

export { Page }
