import semver from 'semver'
import path from 'path'
import fs from 'fs'
import shell from 'shelljs'
import * as yarnLockfile from '@yarnpkg/lockfile'
import {
  dependencyIsDirect,
  userConstraintForDependency,
  getAvailableVersionsOfDependency,
} from './dependency'
import { pathInRepo } from './utils'

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

  static constraintInConstraints(constraint, commaSeparatedConstraints) {
    let parts = commaSeparatedConstraints.split(',')
    parts = parts.map(p => p.trim()) // trim whitespace off each part
    return parts.includes(constraint.trim())
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
    shell.exec(`cd ${this.dirPath} && yarn install --ignore-scripts`)
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
    shell.exec(`cd ${this.dirPath} && yarn upgrade --ignore-scripts`)
  }

  updatePackageLock() {
    shell.exec(`cd ${this.dirPath} && npm update --ignore-scripts --quiet`)
  }

  convertToLockfileSchema() {
    if (this.isYarnLock()) {
      return this.convertYarnLockToLockfileSchema()
    } else if (this.isPackageLock()) {
      return this.convertPackageLockToLockfileSchema()
    } else {
      throw new Error(
        `We don't know how to handle this lockfile: ${lockfilePath}`
      )
    }
  }

  convertToManifestSchema() {
    if (this.isYarnLock()) {
      return this.convertYarnLockToManifestSchema()
    } else if (this.isPackageLock()) {
      return this.convertPackageLockToManifestSchema()
    } else {
      throw new Error(
        `We don't know how to handle this lockfile: ${lockfilePath}`
      )
    }
  }

  convertYarnLockToLockfileSchema() {
    console.log('Converting yarn.lock to lockfile in dependencies-schema')
    const file = fs.readFileSync(this.path, 'utf8')
    const yarnLockfileResults = yarnLockfile.parse(file)

    const dependenciesForSchema = {}

    for (const dep in yarnLockfileResults.object) {
      console.log(dep)
      const info = yarnLockfile.explodeEntry(
        dep,
        yarnLockfileResults.object[dep]
      )

      const isDirectDependency = dependencyIsDirect(info.name, this.dirPath)

      // console.log(dep)
      // console.log(info)

      // if info.version resolves to something that already exists in root
      // then combine constraints
      // but how do we get the first one?

      if (
        isDirectDependency &&
        dep !==
          info.name + '@' + userConstraintForDependency(info.name, this.dirPath)
      ) {
        // make sure we're getting the version that should be installed
        // in the root (not for a nested dependency) by only getting those that have
        // the package.json constraint in them
        continue
      }

      const children = {}
      if (info.dependencies || info.optionalDependencies) {
        if (info.dependencies) {
          for (const child in info.dependencies) {
            children[child] = {
              constraint: info.dependencies[child],
              relationship: 'direct',
            }
          }
        }
        if (info.optionalDependencies) {
          for (const child in info.optionalDependencies) {
            children[child] = {
              constraint: info.optionalDependencies[child],
              relationship: 'optional',
            }
          }
        }
      }

      dependenciesForSchema[info.name] = {
        installed: { name: info.version },
        constraint: dep.replace(`${info.name}@`, ''), // simply keep the comma separated ranges without the name@ parts
        is_transitive: !isDirectDependency,
        source: info.registry,
      }

      if (Object.keys(children).length > 0) {
        dependenciesForSchema[info.name].dependencies = children
      }
    }

    // go back through them and set nested installed versions if different than
    // root node_modules
    for (const depName in dependenciesForSchema) {
      const dep = dependenciesForSchema[depName]
      if (dep.relationship === 'transitive' && dep.dependencies) {
        for (const child in dep.dependencies) {
          const childObj = dep.dependencies[child]
          const yarnResultVersion =
            yarnLockfileResults.object[child + '@' + childObj.constraint]
              .version
          if (
            yarnResultVersion !== dependenciesForSchema[child].installed.version
          ) {
            childObj.installed = { name: yarnResultVersion }
          }
        }
      }
    }

    return { dependencies: dependenciesForSchema, fingerprint: this.getFingerprint() }
  }

  convertYarnLockToManifestSchema() {
    console.log('Converting yarn.lock to manifest dependencies-schema')
    const file = fs.readFileSync(this.path, 'utf8')
    const yarnLockfileResults = yarnLockfile.parse(file)

    const dependenciesForSchema = {}

    for (const dep in yarnLockfileResults.object) {
      const info = yarnLockfile.explodeEntry(
        dep,
        yarnLockfileResults.object[dep]
      )

      // only want direct dependencies for manifest
      if (!dependencyIsDirect(info.name, this.dirPath)) continue

      if (
        dep !==
        info.name + '@' + userConstraintForDependency(info.name, this.dirPath)
      ) {
        // make sure we're getting the version that should be installed
        // in the root (not for a nested dependency) by only getting those that have
        // the package.json constraint in them
        continue
      }

      // simply keep the comma separated ranges without the name@ parts
      const constraint = dep.replace(`${info.name}@`, '')

      // get the available versions and remove anything that is in-range (or versions we know are less than the installed)
      let availableVersions = getAvailableVersionsOfDependency(
        info.name,
        this.dirPath
      )
      availableVersions = availableVersions.filter(
        v => !semver.lte(v, info.version) && !semver.satisfies(v, constraint)
      )
      availableVersions = availableVersions.map(v => ({ name: v }))

      dependenciesForSchema[info.name] = {
        constraint: constraint,
        available: availableVersions,
        source:
          info.resolved.startsWith('https://registry.npmjs.org/') ||
          info.resolved.startsWith('https://registry.yarnpkg.com/')
            ? 'npm'
            : info.resolved,
      }
    }

    return { dependencies: dependenciesForSchema }
  }

  convertPackageLockToLockfileSchema() {
    console.log(
      'Converting package-lock.json to lockfile in dependencies-schema'
    )
    const packageLock = require(path.resolve(this.path))

    // recursively translate the schemas
    const packageLockDependenciesToSchema = dependencies => {
      const dependenciesForSchema = {}

      Object.entries(dependencies).forEach(([name, data]) => {
        // skip bundled dependencies completely
        if (data.bundled) return

        const isDirectDependency = dependencyIsDirect(name, this.dirPath)

        // if there are children in package-lock.json, that means they have their own
        // versions of existing dependencies
        let children = {}
        if (data.dependencies) {
          children = packageLockDependenciesToSchema(data.dependencies)
        }
        //
        // console.log(name)
        // console.log(data)

        // TODO get constraint somehow
        // not easy if not direct -- maybe we only care about direct? technically lockfile
        // doesn't have to change unless installed versions change
        // yarn lockfile has constraints though, so maybe we need to include what they include?
        // need a more concrete yes/no it can be updated (regardless of changes?)
        // or just ONLY care about installed version and which dependencies

        // do we care about hierarchy?

        // only care about reflecting the info that the specific lockfile has
        // in the end, this info is purely for UI/UX purposes -- whether or not the
        // lockfile can_be_updated should be a separate distinction...
        // actually to be useful in UI/UX, it would be nicer if we could just show the diff?
        // without having to compute it?

        dependenciesForSchema[name] = {
          installed: { name: data.version },
          // constraint: '',  // don't have constraint info readily available, doesn't necessarily impact installed versions anyway
          is_transitive: !isDirectDependency,
          source: data.resolved && !data.resolved.startsWith('https://registry.npmjs.org/')
            ? data.resolved
            : 'npm',
        }

        if (Object.keys(children).length > 0) {
          dependenciesForSchema[name].dependencies = children
        }
      })

      return dependenciesForSchema
    }

    return {
      dependencies: packageLockDependenciesToSchema(packageLock.dependencies),
      fingerprint: this.getFingerprint(),
    }
  }

  convertPackageLockToManifestSchema() {
    console.log(
      'Converting package-lock.json to manifest in dependencies-schema'
    )
    const packageLock = require(path.resolve(this.path))
    const dependenciesForSchema = {}

    Object.entries(packageLock.dependencies).forEach(([name, data]) => {
      const isDirectDependency = dependencyIsDirect(name, this.dirPath)
      if (!isDirectDependency) return

      const constraint = userConstraintForDependency(name, this.dirPath)

      // get the available versions and remove anything that is in-range (or versions we know are less than the installed)
      let availableVersions = getAvailableVersionsOfDependency(
        name,
        this.dirPath
      )
      availableVersions = availableVersions.filter(
        v => !semver.lte(v, data.version) && !semver.satisfies(v, constraint)
      )
      availableVersions = availableVersions.map(v => ({ name: v }))

      dependenciesForSchema[name] = {
        constraint: constraint,
        available: availableVersions,
        source: data.resolved.startsWith('https://registry.npmjs.org/')
          ? 'npm'
          : data.resolved,
      }
    })

    return { dependencies: dependenciesForSchema }
  }
}
