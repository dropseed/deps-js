import path from 'path'
import fs from 'fs'
import shell from 'shelljs'
import detectIndent from 'detect-indent'
import npa from 'npm-package-arg'
import semver from 'semver'

import { Lockfile } from './lockfile'
import { dependencyTypesToCollect } from './settings'

export class Manifest {

  static manifestsInPath(dependencyPath) {
    const rootManifest = new Manifest(dependencyPath)
    return [rootManifest, ...rootManifest.getAdditionalManifests()]
  }

  constructor(dependencyPath) {
    console.log('Loading manifest from ' + dependencyPath)

    if (fs.lstatSync(dependencyPath).isDirectory()) {
      this.dirPath = dependencyPath
      this.path = path.join(this.dirPath, 'package.json')
    } else {
      this.dirPath = path.dirname(dependencyPath)
      this.path = dependencyPath
    }

    this.contents = require(path.resolve(this.path))
  }

  constraintForDependency(name) {
    const types = dependencyTypesToCollect()
    for (var i = 0; i < types.length; i++) {
      if (types[i] in this.contents && name in this.contents[types[i]]) {
        return this.contents[types[i]][name]
      }
    }
  }

  convertToSchema() {
    let output = {
      current: {
        dependencies: {}
      },
      updated: {
        dependencies: {}
      },
    }

    shell.config.fatal = false
    const outdated = JSON.parse(
      shell.exec(`cd ${this.dirPath} && npm outdated --json`, { silent: true }).stdout.trim()
    )
    const npmList = JSON.parse(
      shell.exec(`cd ${this.dirPath} && npm ls --json --depth=0`, { silent: true }).stdout.trim()
    )
    shell.config.fatal = true

    dependencyTypesToCollect().forEach(dt => {
      if (dt in this.contents) {
        Object.entries(this.contents[dt]).forEach(([name, constraint]) => {

          const source = this.sourceForDependency(name, constraint)

          output.current.dependencies[name] = {
            'constraint': constraint,
            'source': source,
          }

          let latest = npmList.dependencies[name].version  // assume this is the latest

          if (name in outdated && !semver.satisfies(latest, constraint)) {
            latest = outdated[name].latest

            let latestConstraint = latest
            if (constraint.indexOf('^') !== -1) {
              latestConstraint = '^' + latest
            }
            if (constraint.indexOf('~') !== -1) {
              latestConstraint = '~' + latest
            }

            output.updated.dependencies[name] = {
              'constraint': latestConstraint,
              'source': source,
            }
          }
        })
      }
    })

    return output
  }

  getAdditionalManifests() {
    let output = {}
    try {
      // the command outputs {"type":"log","data":jsonstring}
      output = JSON.parse(
        shell.exec(`cd ${this.dirPath} && yarn workspaces info --json`, { silent: true }).stdout.trim()
      )
    } catch(e) {
      console.log('Unable to find additional manifests')
      return []
    }
    const workspaces = JSON.parse(output.data)
    return Object.values(workspaces).map(ws => new Manifest(path.join(this.dirPath, ws.location)))
  }

  updateFromData(manifestData) {
    const lockfile = 'lockfile_path' in manifestData ? new Lockfile(manifestData.lockfile_path) : null

    Object.entries(manifestData.updated.dependencies).forEach(([name, dependency]) => {
      const installed = manifestData.current.dependencies[name].constraint
      const updatedConstraint = dependency.constraint

      this.updatePackageJSONDependency(name, updatedConstraint)

      if (lockfile && lockfile.existed) {
        lockfile.generate()
      }
    })
  }

  updatePackageJSONDependency(name, constraint) {
    const file = fs.readFileSync(this.path, 'utf8')
    // tries to detect the indentation and falls back to a default if it can't
    const indent = detectIndent(file).indent || '  '
    const packageJson = JSON.parse(file)

    dependencyTypesToCollect().forEach(t => {
      if (packageJson.hasOwnProperty(t) && packageJson[t].hasOwnProperty(name)) {
        console.log(
          `Updating ${name} to ${constraint} in ${t} of ${this.path}`
        )
        packageJson[t][name] = constraint
      }
    })

    fs.writeFileSync(
      this.path,
      JSON.stringify(packageJson, null, indent) + '\n'
    )
  }

  sourceForDependency(name, constraint) {
    const parsed = npa.resolve(name, constraint, this.dirPath)

    if (parsed.type === 'git') return 'git'
    if (parsed.type === 'file') return 'file'
    if (parsed.type === 'directory') return 'directory'

    if (parsed.registry && !parsed.hosted) return 'npm'

    return parsed.type
  }

}
