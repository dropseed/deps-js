import path from 'path'
import shell from 'shelljs'

export const getPackageJSONPath = dependencyPath => {
  return path.join(dependencyPath, 'package.json')
}

export const getPackageJSON = dependencyPath => {
  return require(getPackageJSONPath(dependencyPath))
}

export const outputPackageJSON = dependencyPath => {
  const packageJson = getPackageJSON(dependencyPath)
  console.log('package.json contents:')
  console.log(JSON.stringify(packageJson, null, 2))
}

export const pathInRepo = dependencyPath => {
  if (dependencyPath.startsWith('/repo/')) {
    return dependencyPath.substring(6)
  }
  return dependencyPath
}

export const isInTestMode = () => {
  return (process.env.DEPENDENCIES_ENV || 'production') == 'test'
}

export const pushGitBranch = (branchName) => {
  if (isInTestMode()) {
    console.log('Not pushing branch in test mode')
    return
  }
  shell.exec(`git push --set-upstream origin ${branchName}`)
}

export const createGitBranch = (branchName) => {
  // branch off of the original commit that this build is on
  shell.exec(`git checkout ${process.env.GIT_SHA}`)
  shell.exec(`git checkout -b ${branchName}`)
}
