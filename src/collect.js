import { Lockfile } from './lockfile'
import { getAvailableVersionsOfDependency } from './dependency'
import { outputSchema } from './schema'
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
      [manifestPath]: lockfile.convertToManifestSchema(),
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

    lockfile.update()

    // only include updated if it's different?

    // do we need a way to ensure that these are the changes that end up getting made?
    // i.e. other changes happen between now and action...
    // git diff, hash of file...

    const updatedSchema = lockfile.convertToLockfileSchema()

    const lockfilePath = pathInRepo(lockfile.path)

    output.lockfiles = {
      [lockfilePath]: {
        current: originalSchema,
        updated: updatedSchema,
      },
    }

    output.manifests[manifestPath].lockfile_path = lockfilePath
  }

  outputSchema(output)
}
