import path from 'path'
import fs from 'fs'
import shell from 'shelljs'
import shellEscape from 'shell-escape'
import detectIndent from 'detect-indent'
import flatten from 'flatten'
import glob from 'glob'
import npa from 'npm-package-arg'

import { Lockfile } from './lockfile'
import { dependencyTypesToCollect } from './settings'
import { getAvailableVersionsOfDependency } from './dependency'

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
    console.log(JSON.stringify(this.contents, null, 2))
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
    let dependencies = {}

    dependencyTypesToCollect().forEach(dt => {
      if (dt in this.contents) {
        Object.entries(this.contents[dt]).forEach(([name, constraint]) => {

          const source = this.sourceForDependency(name, constraint)

          let availableVersions = []
          if (source !== 'file' && source !== 'directory') {
            availableVersions = getAvailableVersionsOfDependency(name, constraint).map(v => ({ name: v }))
          }

          dependencies[name] = {
            'constraint': constraint,
            'source': source,
            'available': availableVersions,
          }
        })
      }
    })

    return {
      'current': {
        'dependencies': dependencies
      }
    }
  }

  getAdditionalManifests() {
    if ('workspaces' in this.contents) {
      const root = this.dirPath
      const arrays = this.contents.workspaces.map(ws => (
        glob.sync(path.join(root, ws)).map(p => new Manifest(p))
      ))
      return flatten(arrays)
    }

    return []
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

      const msg = `Update ${name} from ${installed} to ${updatedConstraint}`
      shell.exec(`deps commit -m "${msg}" .`)
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
