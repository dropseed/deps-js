export const dependencyTypesToCollect = () => {
  const types = JSON.parse(process.env.DEPS_SETTING_MANIFEST_PACKAGE_TYPES || '["dependencies", "devDependencies"]')
  // optionally remove devDependencies if the node_env setting was used
  if (nodeEnv() === 'production' && types.indexOf('devDependencies') > -1) {
    types.splice(types.indexOf('devDependencies'), 1)
  }
  return types
}

export const nodeEnv = () => {
  return process.env.NODE_ENV || 'development'
}
