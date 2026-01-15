import merge from 'deepmerge'
import { config as wdioConf } from './wdio.conf.js'

export const config = merge(wdioConf, {
  specs: ['./specs/noJavascript/**/*.js'],
  maxInstances: 3,
  capabilities: [
    {
      browserName: 'chrome',
      browserVersion: 'stable',
      'goog:chromeOptions': {
        prefs: { 'profile.managed_default_content_settings.javascript': 2 },
        args: ['headless', 'disable-gpu']
      }
    }
  ]
})
