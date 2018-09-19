import path from 'path'
import semver from 'semver'

import { dependencyTypesToCollect } from './settings'
import { getInstalledVersionOfDependency } from './dependency'
import { Manifest } from './manifest'
import { Lockfile } from './lockfile'

export class RangeUpdater {
  constructor(p) {
    this.dir = p
    this.contents = require(path.resolve(path.join(this.dir, 'package.json')))
  }

  update() {
    var madeUpdates = false

    dependencyTypesToCollect().forEach(dt => {
      if (dt in this.contents) {
        Object.entries(this.contents[dt]).forEach(([name, constraint]) => {
          if (semver.validRange(constraint)) {
            console.log(`${name} uses a range constraint of ${constraint}`)

            const installed = getInstalledVersionOfDependency(name)
            console.log(`${name} version ${installed} is installed currently`)

            const updatedConstraint = updateLowerBoundOfRange(constraint, installed)

            if (semver.Range(constraint) == semver.Range(updatedConstraint)) {
              console.log(`Original constraint looks the same as the updated range, skipping (${constraint} to ${updatedConstraint})`)
              return
            }

            console.log(`Updating range for ${constraint} to ${updatedConstraint}`)
            new Manifest(this.dir).updatePackageJSONDependency(name, updatedConstraint)
            madeUpdates = true
          }
        })
      }
    })

    if (madeUpdates) {
      // install lockfile again
      const lockfile = new Lockfile(this.dir)
      if (lockfile.existed) {
        console.log('Updating lockfile with new package.json range changes')
        lockfile.generate()
      }
    }
  }

}

function updateLowerBoundOfRange(constraint, minimumVersion) {
  const tmp = semver.Range(constraint)

  if (tmp.set.length !== 1) {
    console.log('There is more than 1 set of ranges. We don\'t know how to update that yet.')
    return constraint
  }

  // if using a shorthand, just update it manually
  if (constraint.indexOf('^') !== -1) {
    return '^' + minimumVersion
  }
  if (constraint.indexOf('~') !== -1) {
    return '~' + minimumVersion
  }

  // attempt to update(replace) the first comparator of the first range
  // with our currently installed version while keeping the operator
  tmp.set[0][0] = semver.Comparator(tmp.set[0][0].operator + minimumVersion)
  return tmp.format()
}
