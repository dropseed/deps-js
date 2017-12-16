import shell from 'shelljs'
import semver from 'semver'
import { getPackageJSON } from './utils'

let infoCache = {}

export const dependencyIsDirect = (name, dependencyPath) => {
  return userConstraintForDependency(name, dependencyPath) !== null
}

export const userConstraintForDependency = (name, dependencyPath) => {
  const packageJson = getPackageJSON(dependencyPath)

  if (
    packageJson.dependencies &&
    packageJson.dependencies.hasOwnProperty(name)
  ) {
    return packageJson.dependencies[name]
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    packageJson.devDependencies &&
    packageJson.devDependencies.hasOwnProperty(name)
  ) {
    return packageJson.devDependencies[name]
  }

  return null
}

export const getAvailableVersionsOfDependency = (name, dependencyPath) => {
  console.log(`Finding available versions for ${name}`)
  let info = {}

  if (infoCache.hasOwnProperty(name)) {
    console.log(`Getting info for ${name} from cache`)
    info = infoCache[name]
  } else {
    try {
      info = JSON.parse(
        shell.exec(`npm view ${name} --json`, { silent: true }).stdout.trim()
      )
    } catch (e) {
      console.log(e)
      return []
    }
  }

  let available = info.versions

  if (available.length < 1) {
    console.log(
      `No available versions of ${name} were found in npm. See output above.`
    )
  } else if (dependencyIsDirect(name, dependencyPath) && info['dist-tags']) {
    // for direct dependencies, make sure we only report versions for the
    // dist-tag ("latest" by default) that they're using or specified in settings
    available = filterVersionsForDistTag(
      name,
      available,
      info['dist-tags'],
      dependencyPath
    )
  }

  return available
}

const filterVersionsForDistTag = (name, versions, distTags, dependencyPath) => {
  let distTagInUse = 'latest'

  // check if they are using a dist-tag as the requirement, i.e. "semantic-release": "next"
  const range = userConstraintForDependency(name, dependencyPath)
  if (range !== null) {
    for (var dt in distTags) {
      if (distTags.hasOwnProperty(dt) && range === dt) {
        distTagInUse = dt
        break
      }
    }
  }

  // if they specified a dist-tag to follow in settings, then override with that
  const dist_tag_mappings = JSON.parse(process.env.SETTING_DIST_TAGS || '{}')
  if (dist_tag_mappings.hasOwnProperty(name)) {
    distTagInUse = dist_tag_mappings[name]
  }

  // remove available versions above the chosen dist-tag ("latest" by default)
  const distTagVersion = distTags[distTagInUse]
  console.log(
    `Only collecting versions of ${name} below "${distTagInUse}" (${distTagVersion})...`
  )

  return versions.filter(v => semver.lte(v, distTagVersion))
}
