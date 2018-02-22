import fs from 'fs'
import shell from 'shelljs'
import shellEscape from 'shell-escape'
import { Lockfile } from './lockfile'
import { getAvailableVersionsOfDependency } from './dependency'
import { getPackageJSONPath } from './utils'

export const collect = dependencyPath => {
  const lockfile = new Lockfile(dependencyPath)

  if (!lockfile.existed) {
    lockfile.generate()
    // TODO still need to handle no dependencies scenario here
  }

  const manifestPath = getPackageJSONPath(dependencyPath)

  let output = {
    manifests: {
      [manifestPath]: {current: lockfile.convertToManifestSchema()},
    },
  }

  if (lockfile.existed) {
    const originalSchema = lockfile.convertToLockfileSchema()

    output.lockfiles = {
      [lockfile.path]: {
        current: originalSchema,
      },
    }

    lockfile.update()
    const updatedSchema = lockfile.convertToLockfileSchema()
    if (updatedSchema.fingerprint !== originalSchema.fingerprint) {
      // only include in output if the file actually changed
      output.lockfiles[lockfile.path].updated = updatedSchema
    }

    // point the manifest entry to this lockfile
    output.manifests[manifestPath].lockfile_path = lockfile.path
  }

  const dependenciesJson = '/tmp/collected.json'
  fs.writeFileSync(dependenciesJson, JSON.stringify(output))
  shell.exec(shellEscape(['deps', 'collect', dependenciesJson]))
}
