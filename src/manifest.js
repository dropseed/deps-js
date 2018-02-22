import path from 'path'
import fs from 'fs'
import shell from 'shelljs'
import shellEscape from 'shell-escape'
import detectIndent from 'detect-indent'

import { Lockfile } from './lockfile'
import { getPackageJSONPath } from './utils'

const updatePackageJSONDependencyVersion = (packageJSONPath, name, constraint) => {
  const file = fs.readFileSync(packageJSONPath, 'utf8')
  // tries to detect the indentation and falls back to a default if it can't
  const indent = detectIndent(file).indent || '  '
  const packageJson = JSON.parse(file)

  const depTypes = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
    'bundledDependencies',
  ]

  depTypes.forEach(t => {
    if (packageJson.hasOwnProperty(t) && packageJson[t].hasOwnProperty(name)) {
      console.log(
        `Updating ${name} to ${constraint} in ${t} of ${packageJSONPath}`
      )
      packageJson[t][name] = constraint
    }
  })

  fs.writeFileSync(
    packageJSONPath,
    JSON.stringify(packageJson, null, indent) + '\n'
  )
}

export const updateManifest = (manifestPath, manifest) => {
  const dependencyPath = path.dirname(manifestPath)
  const lockfile = new Lockfile(dependencyPath)

  const packageJSONPath = getPackageJSONPath(dependencyPath)

  const nodeModulesPath = path.join(dependencyPath, 'node_modules')
  const tmpNodeModulesPath = path.join('/tmp', nodeModulesPath)

  Object.entries(manifest.updated.dependencies).forEach(([name, dependency]) => {
    const installed = manifest.current.dependencies[name].constraint
    const updatedConstraint = dependency.constraint

    const msg = `Update ${name} from ${installed} to ${updatedConstraint}`

    if (fs.existsSync(nodeModulesPath) && !fs.existsSync(tmpNodeModulesPath)) {
      // install everything the first time, then keep a copy of those node_modules
      // so we can copy them back in before we work on each branch
      lockfile.generate()
      if (!lockfile.existed) {
        shell.exec(`rm -rf ${lockfile.path}`)
      }

      // save these in /tmp for future branches working on the same file
      console.log(
        `Copying node_modules from ${nodeModulesPath} into ${tmpNodeModulesPath} for future use...`
      )
      shell.mkdir('-p', tmpNodeModulesPath)
      shell.cp('-R', nodeModulesPath, tmpNodeModulesPath)
    } else if (fs.existsSync(tmpNodeModulesPath)) {
      // copy our cached node_modules in
      console.log(
        `Copying node_modules from ${tmpNodeModulesPath} into ${nodeModulesPath}...`
      )
      shell.cp('-R', tmpNodeModulesPath, nodeModulesPath)
    }

    updatePackageJSONDependencyVersion(packageJSONPath, name, updatedConstraint)

    if (lockfile.existed) {
      if (lockfile.isYarnLock()) {
        shell.exec(`cd ${dependencyPath} && yarn install --ignore-scripts`)
      } else if (lockfile.isPackageLock()) {
        shell.exec(
          `cd ${dependencyPath} && npm update ${name} --ignore-scripts --quiet`
        )
      }

      shell.exec(`git add ${lockfile.path}`)
    }

    // remove node_modules if they exist
    shell.rm('-rf', nodeModulesPath)

    shell.exec(`deps commit -m "${msg}" ${packageJSONPath}`)
  })
}
