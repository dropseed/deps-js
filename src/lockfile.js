import path from 'path'
import fs from 'fs'
import shell from 'shelljs'
import md5File from 'md5-file'
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
    return md5File.sync(this.path)
  }

  isYarnLock() {
    return path.basename(this.path) === 'yarn.lock'
  }

  isPackageLock() {
    return path.basename(this.path) === 'package-lock.json'
  }

  isYarn4() {
    return shell.exec('yarn --version').stdout.startsWith('4.')
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
    if (this.isYarn4()) {
      shell.exec(`cd ${this.dirPath} && yarn install --mode=update-lockfile`)
    } else {
      shell.exec(
        `cd ${this.dirPath} && yarn install --ignore-scripts --ignore-engines --ignore-platform`
      )
    }
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
    if (this.isYarn4()) {
      shell.exec(`cd ${this.dirPath} && yarn up --mode=update-lockfile`)
    } else {
      try {
        shell.exec(
          `cd ${this.dirPath} && yarn upgrade --ignore-scripts --ignore-engines --ignore-platform`
        )
      } catch (e) {
        // may throw an 'Outdated lockfile' error, meaning install has to be run first
        this.generateYarnLock()
        shell.exec(
          `cd ${this.dirPath} && yarn upgrade --ignore-scripts --ignore-engines --ignore-platform`
        )
      }
    }
  }

  updatePackageLock() {
    shell.exec(
      `cd ${this.dirPath} && npm update --dev --ignore-scripts --quiet`
    )
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

    const dependenciesForSchema = {}

    if (this.isYarn4()) {
      const output = shell.exec(
        `cd ${this.dirPath} && yarn info --all --recursive --json`
      )
      for (const line of output.split('\n')) {
        if (line === '') continue
        const info = JSON.parse(line)

        // Skip anything that doesn't look like it's from npm for now...
        if (info.value.indexOf('@npm:') === -1) continue

        const name = info.value.split('@')[0]
        const version = info.children.Version;
        const is_transitive = this.manifestConstraintForDependency(name) === undefined
        dependenciesForSchema[name] = {
          version: { name: version },
          is_transitive: is_transitive,
          source: "npm",
        }
      }
    } else {

      // TODO windows line endings are currently broken: https://github.com/yarnpkg/yarn/issues/5214
      const file = fs.readFileSync(this.path, 'utf8').replace(/\r/g, '')
      const yarnLockfileResults = yarnLockfile.parse(file)

      for (const dep in yarnLockfileResults.object) {
        const info = yarnLockfile.explodeEntry(
          dep,
          yarnLockfileResults.object[dep]
        )

        const manifestConstraint = this.manifestConstraintForDependency(info.name)

        if (manifestConstraint && dep !== info.name + '@' + manifestConstraint) {
          // make sure we're getting the version that should be installed
          // in the root (not for a nested dependency) by only getting those that have
          // the package.json constraint in them
          continue
        }

        dependenciesForSchema[info.name] = {
          version: { name: info.version },
          // constraint: dep.replace(`${info.name}@`, ''), // simply keep the comma separated ranges without the name@ parts
          is_transitive: manifestConstraint === undefined,
          source: info.registry,
        }
      }

    }

    return {
      dependencies: dependenciesForSchema,
      fingerprint: this.getFingerprint(),
    }
  }

  convertPackageLockToSchema() {
    console.log(
      'Converting package-lock.json to lockfile in dependencies-schema'
    )
    const packageLock = require(path.resolve(this.path))
    const dependenciesForSchema = {}

    if (packageLock.lockfileVersion < 3) {
      Object.entries(packageLock.dependencies).forEach(([name, data]) => {
        // skip bundled dependencies completely
        if (data.bundled) return

        const manifestConstraint = this.manifestConstraintForDependency(name)

        dependenciesForSchema[name] = {
          version: { name: data.version },
          is_transitive: manifestConstraint === undefined,
          source:
            data.resolved &&
            !data.resolved.startsWith('https://registry.npmjs.org/')
              ? data.resolved
              : 'npm',
        }
      })
    } else {
      Object.entries(packageLock.packages).forEach(([key, data]) => {
        if (!key) return // The root package is an empty string

        // Assume packages we care about start with node_modules/
        if (!key.startsWith('node_modules/')) return

        const name = key.split('/')[1]
        const version = data.version
        const manifestConstraint = this.manifestConstraintForDependency(name)

        dependenciesForSchema[name] = {
          version: { name: version },
          is_transitive: manifestConstraint === undefined,
          source: data.resolved &&
            !data.resolved.startsWith('https://registry.npmjs.org/')
            ? data.resolved
            : 'npm',
        }
      })
    }

    return {
      dependencies: dependenciesForSchema,
      fingerprint: this.getFingerprint(),
    }
  }
}
