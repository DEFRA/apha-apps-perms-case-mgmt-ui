import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '../../config.js'
import { buildNavigation } from './build-navigation.js'
import { createLogger } from '../../../server/common/helpers/logging/logger.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/assets-manifest.json'
)

let webpackManifest

export function context(request) {
  if (!webpackManifest) {
    try {
      webpackManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Webpack ${path.basename(manifestPath)} not found`)
    }
  }

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: '/',
    breadcrumbs: [],
    accountBanner: buildAccountBanner(request),
    navigation: buildNavigation(request),
    getAssetPath(asset) {
      const webpackAssetPath = webpackManifest?.[asset]
      return `${assetPath}/${webpackAssetPath ?? asset}`
    }
  }
}

function buildAccountBanner(request) {
  const user = request?.auth?.credentials

  if (!user?.isAuthenticated || !user) {
    return null
  }

  const fullNameParts = [
    user.givenName?.trim(),
    user.familyName?.trim()
  ].filter(Boolean)

  const fullName = fullNameParts.join(' ')

  if (!fullName) {
    return null
  }

  return {
    fullName,
    signOutPath: '/auth/logout'
  }
}
