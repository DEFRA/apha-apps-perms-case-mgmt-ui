import { browser } from '@wdio/globals'

export const verifyPageTitle = async (pageTitle) => {
  const titleMatches = async () => {
    const title = await browser.getTitle()
    return title === pageTitle || title === `Error: ${pageTitle}`
  }

  await browser.waitUntil(titleMatches, {
    timeoutMsg: `Expected page title to be "${pageTitle}" or "Error: ${pageTitle}"\nReceived:\t"${await browser.getTitle()}"`
  })
}

export const loadPageAndVerifyTitle = async (
  path,
  pageTitle,
  preview = true
) => {
  const url = preview ? `${path}?force=true` : path

  await browser.url(url)
  await verifyPageTitle(pageTitle)
}
