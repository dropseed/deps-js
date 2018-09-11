import fs from 'fs'


export const dependencyTypesToCollect = () => {
  const types = JSON.parse(process.env.SETTING_MANIFEST_PACKAGE_TYPES || '["dependencies", "devDependencies"]')
  // optionally remove devDependencies if the node_env setting was used
  if (nodeEnv() === 'production' && types.indexOf('devDependencies') > -1) {
    types.splice(types.indexOf('devDependencies'), 1)
  }
  return types
}

export const nodeEnv = () => {
  return process.env.SETTING_NODE_ENV || 'development'
}

export const setNodeEnv = () => {
  // set the NODE_ENV to the user's config setting
  process.env.NODE_ENV = nodeEnv()
}

export const setNPMRC = () => {
  const NPMRC = process.env.SETTING_NPMRC
  if (NPMRC) {
    console.log(
      '.npmrc contents found in settings, writing to /home/app/.npmrc...'
    )
    fs.writeFileSync('/home/app/.npmrc', NPMRC)
    console.log(NPMRC)
  }
}

export const updatePackageJSONLowerBounds = () => {
  return process.env.SETTING_UPDATE_PACKAGE_JSON_LOWER_BOUNDS === 'true'
}
