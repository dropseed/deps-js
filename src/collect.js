import { Lockfile } from './lockfile'
import { getAvailableVersionsOfDependency } from './dependency'
import { outputDependencies } from './schema'
import { getPackageJSONPath, pathInRepo } from './utils'

export const collect = dependencyPath => {
  const lockfile = new Lockfile(dependencyPath)

  if (!lockfile.existed) {
    lockfile.generate()
    // TODO still need to handle no dependencies scenario here
  }

  const manifestPath = pathInRepo(getPackageJSONPath(dependencyPath))

  let output = {
    manifests: {
      [manifestPath]: {current: lockfile.convertToManifestSchema()},
    },
  }

  if (lockfile.existed) {
    const originalSchema = lockfile.convertToLockfileSchema()
    const lockfilePath = pathInRepo(lockfile.path)

    output.lockfiles = {
      [lockfilePath]: {
        current: originalSchema,
      },
    }

    lockfile.generate()  // run 'install' first, so 'update' doesn't complain
    lockfile.update()
    const updatedSchema = lockfile.convertToLockfileSchema()
    if (updatedSchema.fingerprint !== originalSchema.fingerprint) {
      // only include in output if the file actually changed
      output.lockfiles[lockfilePath].updated = updatedSchema
    }

    // point the manifest entry to this lockfile
    output.manifests[manifestPath].lockfile_path = lockfilePath
  }

  outputDependencies(output)
}
