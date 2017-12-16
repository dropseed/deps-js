import path from 'path'
import fs from 'fs'
import shell from 'shelljs'
import shellEscape from 'shell-escape'
import detectIndent from 'detect-indent'

import { Lockfile } from './lockfile'
import { getPackageJSONPath, pushGitBranch, createGitBranch } from './utils'
import { outputSchema } from './schema'

const updatePackageJSONDependencyVersion = (packageJSONPath, name, version) => {
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

  let updatedConstraint

  depTypes.forEach(t => {
    if (packageJson.hasOwnProperty(t) && packageJson[t].hasOwnProperty(name)) {
      const currentRange = packageJson[t][name]
      // get the prefix they were using and keep using it
      let packageJsonVersionRangeSpecifier = ''
      if (currentRange.startsWith('^')) {
        packageJsonVersionRangeSpecifier = '^'
      } else if (currentRange.startsWith('~')) {
        packageJsonVersionRangeSpecifier = '~'
      }
      // update package.json with the new range
      const constraint = packageJsonVersionRangeSpecifier + version
      console.log(
        `Updating ${name} to ${constraint} in ${t} of ${packageJSONPath}`
      )
      packageJson[t][name] = constraint

      updatedConstraint = constraint
    }
  })

  fs.writeFileSync(
    packageJSONPath,
    JSON.stringify(packageJson, null, indent) + '\n'
  )

  return updatedConstraint
}

export const updateManifest = (manifestPath, schema) => {
  const ACTOR_ID = process.env.ACTOR_ID
  const BATCH_MODE = process.env.SETTING_BATCH_MODE == 'true'
  const COMMIT_MESSAGE_PREFIX = process.env.SETTING_COMMIT_MESSAGE_PREFIX || ''

  const batchPrBranchName = `dependencies.io-update-build-${ACTOR_ID}`
  if (BATCH_MODE) createGitBranch(batchPrBranchName)

  const dependencyPath = path.join('/repo', path.dirname(manifestPath))
  const lockfile = new Lockfile(dependencyPath)

  const packageJSONPath = getPackageJSONPath(dependencyPath)

  const nodeModulesPath = path.join(dependencyPath, 'node_modules')
  const tmpNodeModulesPath = path.join('/tmp', nodeModulesPath)

  Object.entries(schema.dependencies).forEach(([name, dependency]) => {
    console.log(dependency)

    const installed = dependency.installed.name

    const version = dependency.available[0].name
    const branchName = `${name}-${version}-${ACTOR_ID}`
    const msg = `${COMMIT_MESSAGE_PREFIX}Update ${name} from ${installed} to ${version}`

    if (!BATCH_MODE) createGitBranch(branchName)

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

    const updatedConstraint = updatePackageJSONDependencyVersion(packageJSONPath, name, version)

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

    shell.exec(`git add ${packageJSONPath}`)
    shell.exec(`git commit -m "${msg}"`)

    // fail if there are other unchanged files
    if (shell.exec('git status --porcelain').stdout.trim() != '') {
      throw "Git repo is dirty, there are changes that aren't accounted for\n" +
        shell.exec('git status').stdout
    }

    dependency.installed.name = version
    dependency.constraint = updatedConstraint
    delete dependency.available

    if (!BATCH_MODE) {
      pushGitBranch(branchName)

      const resultSchema = {
        manifests: {
          [manifestPath]: {
            dependencies: {
              [name]: dependency
            }
          }
        },
      }
      // TODO needs to use new schema
      // shell.exec(shellEscape(['pullrequest', '--branch', branchName, '--dependencies-schema', JSON.stringify(resultSchema), '--title-from-schema', '--body-from-schema']))
      outputSchema(resultSchema)
    }
  })

  if (BATCH_MODE) {
    pushGitBranch(batchPrBranchName)

    const resultSchema = {
      manifests: { [manifestPath]: { dependencies: schema.dependencies } },
    }
    // shell.exec(shellEscape(['pullrequest', '--branch', batchPrBranchName, '--dependencies-schema', JSON.stringify(resultSchema), '--title-from-schema', '--body-from-schema']))
    outputSchema(resultSchema)
  }
}
