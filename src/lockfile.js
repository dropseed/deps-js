import path from 'path'
import fs from 'fs'
import shell from 'shelljs'
import * as yarnLockfile from '@yarnpkg/lockfile'

import { Manifest } from './manifest'

export class Lockfile {
  constructor(dependencyPath) {
    this.path = Lockfile.getLockfilePath(dependencyPath)
    if (this.path === null) {
      this.existed = false
      this.path = path.join(dependencyPath, 'yarn.lock')
    } else {
      this.existed = true
    }
    this.dirPath = path.resolve(path.dirname(this.path))
    this.manifests = Manifest.manifestsInPath(this.dirPath)
  }

  static getLockfilePath(dependencyPath) {
    const lockfiles = ['yarn.lock', 'package-lock.json']

    // if given the file, just return that path back
    if (lockfiles.includes(path.basename(dependencyPath))) {
      return dependencyPath
    }

    for (let i = 0; i < lockfiles.length; i++) {
      const lockfilePath = path.join(dependencyPath, lockfiles[i])
      if (fs.existsSync(lockfilePath)) {
        return lockfilePath
      }
    }
    return null
  }

  getFingerprint() {
    return shell
      .exec(`md5sum ${this.path}`, { silent: true })
      .stdout.trim()
      .split(' ')[0]
  }

  isYarnLock() {
    return path.basename(this.path) === 'yarn.lock'
  }

  isPackageLock() {
    return path.basename(this.path) === 'package-lock.json'
  }

  generate() {
    if (this.isYarnLock()) {
      return this.generateYarnLock()
    } else if (this.isPackageLock()) {
      return this.generatePackageLock()
    } else {
      throw new Error(
        `We don't know how to handle this lockfile: ${lockfilePath}`
      )
    }
  }

  generateYarnLock() {
    shell.exec(`cd ${this.dirPath} && yarn install --ignore-scripts --ignore-engines --ignore-platform`)
  }

  generatePackageLock() {
    // abort()
    // fs.unlinkSync(this.path)
    // shell.exec(`cd ${path.dirname(this.path)} && yarn install --ignore-scripts`)
    shell.exec(`cd ${this.dirPath} && npm install --ignore-scripts --quiet`)
  }

  update() {
    if (this.isYarnLock()) {
      return this.updateYarnLock()
    } else if (this.isPackageLock()) {
      return this.updatePackageLock()
    } else {
      throw new Error(
        `We don't know how to handle this lockfile: ${lockfilePath}`
      )
    }
  }

  updateYarnLock() {
    shell.exec(`cd ${this.dirPath} && yarn upgrade --ignore-scripts --ignore-engines --ignore-platform`)
  }

  updatePackageLock() {
    shell.exec(`cd ${this.dirPath} && npm update --ignore-scripts --quiet`)
  }

  manifestConstraintForDependency(name) {
    for (var i = 0; i < this.manifests.length; i++) {
      const constraint = this.manifests[i].constraintForDependency(name)
      if (constraint) return constraint
    }
  }

  convertToSchema() {
    if (this.isYarnLock()) {
      return this.convertYarnLockToSchema()
    } else if (this.isPackageLock()) {
      return this.convertPackageLockToSchema()
    } else {
      throw new Error(
        `We don't know how to handle this lockfile: ${lockfilePath}`
      )
    }
  }

  convertYarnLockToSchema() {
    console.log('Converting yarn.lock to lockfile in dependencies-schema')
    const file = fs.readFileSync(this.path, 'utf8')
    const yarnLockfileResults = yarnLockfile.parse(file)

    const dependenciesForSchema = {}

    for (const dep in yarnLockfileResults.object) {
      const info = yarnLockfile.explodeEntry(
        dep,
        yarnLockfileResults.object[dep]
      )

      const manifestConstraint = this.manifestConstraintForDependency(info.name)

      if (
        manifestConstraint &&
        dep !==
          info.name + '@' + manifestConstraint
      ) {
        // make sure we're getting the version that should be installed
        // in the root (not for a nested dependency) by only getting those that have
        // the package.json constraint in them
        continue
      }

      dependenciesForSchema[info.name] = {
        installed: { name: info.version },
        constraint: dep.replace(`${info.name}@`, ''), // simply keep the comma separated ranges without the name@ parts
        is_transitive: manifestConstraint === undefined,
        source: info.registry,
      }
    }

    return { dependencies: dependenciesForSchema, fingerprint: this.getFingerprint() }
  }

  convertPackageLockToSchema() {
    console.log(
      'Converting package-lock.json to lockfile in dependencies-schema'
    )
    const packageLock = require(path.resolve(this.path))

    const dependenciesForSchema = {}

    Object.entries(packageLock.dependencies).forEach(([name, data]) => {
      // skip bundled dependencies completely
      if (data.bundled) return

      const manifestConstraint = this.manifestConstraintForDependency(name)

      dependenciesForSchema[name] = {
        installed: { name: data.version },
        is_transitive: manifestConstraint === undefined,
        source: data.resolved && !data.resolved.startsWith('https://registry.npmjs.org/')
          ? data.resolved
          : 'npm',
      }
    })

    return {
      dependencies: dependenciesForSchema,
      fingerprint: this.getFingerprint(),
    }
  }
}
