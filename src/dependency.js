import shell from 'shelljs'
import semver from 'semver'
import cache from 'memory-cache'

export const getAvailableVersionsOfDependency = (name, constraint) => {
  console.log(`Finding available versions for ${name}`)
  let info = {}
  const cached = cache.get(name)

  if (cached !== null) {
    info = cached
  } else {
    try {
      info = JSON.parse(
        shell.exec(`npm view ${name} --json`, { silent: true }).stdout.trim()
      )
    } catch (e) {
      console.log(e)
      return []
    }

    cache.put(name, info)
  }

  let available = info.versions

  if (available.length < 1) {
    console.log(
      `No available versions of ${name} were found in npm. See output above.`
    )
  } else if (info['dist-tags']) {
    // for direct dependencies, make sure we only report versions for the
    // dist-tag ("latest" by default) that they're using or specified in settings
    available = filterVersionsForDistTag(
      name,
      available,
      info['dist-tags'],
      constraint
    )
  }

  // only return versions greater than the current constraint covers
  // (if the 'constraint' isn't a git repo or something like that)
  if (semver.validRange(constraint)) {
    available = available.filter(v => semver.gtr(v, constraint))
  }

  return available
}

export const getInstalledVersionOfDependency = (name) => {
  try {
    const data = JSON.parse(
      shell.exec(`npm ls ${name} --depth=0 --json`, { silent: true }).stdout.trim()
    )
    return data.dependencies[name].version
  } catch (e) {
    console.log(e)
    return null
  }
}

const filterVersionsForDistTag = (name, versions, distTags, constraint) => {
  let distTagInUse = 'latest'

  // check if they are using a dist-tag as the requirement, i.e. "semantic-release": "next"
  if (constraint !== null) {
    for (var dt in distTags) {
      if (distTags.hasOwnProperty(dt) && constraint === dt) {
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
