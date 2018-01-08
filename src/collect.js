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

  // both need
  // - installed
  // - source
  // - constraint

  // lockfile schema needs
  // - dependencies { installed (if unique), source, constraint}
  // - relationship
  // - (available comes from "updated" lockfile - only need that 1 version change)

  // manifest needs
  // - available

  if (lockfile.existed) {
    const originalSchema = lockfile.convertToLockfileSchema()
    const lockfilePath = pathInRepo(lockfile.path)

    output.lockfiles = {
      [lockfilePath]: {
        current: originalSchema,
      },
    }

    lockfile.update()
    const updatedSchema = lockfile.convertToLockfileSchema()
    if (updatedSchema.checksum !== originalSchema.checksum) {
      // only include in output if the file actually changed
      output.lockfiles[lockfilePath].updated = updatedSchema
    }

    // point the manifest entry to this lockfile
    output.manifests[manifestPath].current.lockfile_path = lockfilePath
  }

  outputDependencies(output)
}
