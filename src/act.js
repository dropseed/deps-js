import fs from 'fs'
import shell from 'shelljs'
import shellEscape from 'shell-escape'
import path from 'path'
import { Manifest } from './manifest'
import { Lockfile } from './lockfile'
import { updatePackageJSONLowerBounds } from './settings'
import { RangeUpdater } from './range-updater'

export const act = (inputPath, outputPath) => {
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

  if (data.lockfiles) {
    Object.entries(data.lockfiles).forEach(([lockfilePath, lockfileData]) => {
      const lockfile = new Lockfile(lockfilePath)
      lockfile.update()

      lockfileData.updated = lockfile.convertToSchema()

      if (updatePackageJSONLowerBounds()) {
        // we don't bother reporting these as manifest updates because there won't
        // be a collision with the normal manifest updates since these are in-range changes
        // which are excluded from manifest updates
        lockfile.manifests.forEach(manifest => {
          const ru = new RangeUpdater(path.dirname(manifest.path))
          ru.update()
        })
      }
    })
  }

  if (data.manifests) {
    Object.entries(data.manifests).forEach(([path, manifestData]) => {
      new Manifest(path).updateFromData(manifestData)
    })
  }

  fs.writeFileSync(outputPath, JSON.stringify(data))
}
