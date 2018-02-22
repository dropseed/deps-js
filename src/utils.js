import path from 'path'
import shell from 'shelljs'

export const getPackageJSONPath = dependencyPath => {
  return path.join(dependencyPath, 'package.json')
}

export const getPackageJSON = dependencyPath => {
  return require(path.resolve(getPackageJSONPath(dependencyPath)))
}

export const outputPackageJSON = dependencyPath => {
  const packageJson = getPackageJSON(dependencyPath)
  console.log('package.json contents:')
  console.log(JSON.stringify(packageJson, null, 2))
}
