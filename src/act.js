import fs from 'fs'
import shell from 'shelljs'
import shellEscape from 'shell-escape'
import path from 'path'
import { Manifest } from './manifest'
import { Lockfile } from './lockfile'
import { updatePackageJSONLowerBounds } from './settings'
import { RangeUpdater } from './range-updater'

export const act = () => {
  const data = JSON.parse(fs.readFileSync('/dependencies/input_data.json', 'utf8'))

  shell.exec("deps branch")

  if (data.lockfiles) {
    Object.entries(data.lockfiles).forEach(([lockfilePath, lockfileData]) => {
      const lockfile = new Lockfile(lockfilePath)
      lockfile.update()

      // commit everything that was changed (scripts may have updated other files)
      shell.exec(`deps commit -m "Update ${lockfile.path}" .`)

      lockfileData.updated = lockfile.convertToSchema()

      if (updatePackageJSONLowerBounds) {
        // we don't bother reporting these as manifest updates because there won't
        // be a collision with the normal manifest updates since these are in-range changes
        // which are excluded from manifest updates
        lockfile.manifests.forEach(manifest => {
          const ru = new RangeUpdater(path.dirname(manifest.path))
          ru.update()
        })
        try {
          shell.exec(`deps commit -m "Update lower bounds in package.json ranges" .`)
        } catch (e) {
          console.log('Failed to commit any changes to lower bounds. Probably wasn\'t anything to commit.')
        }
      }
    })
  }

  if (data.manifests) {
    Object.entries(data.manifests).forEach(([path, manifestData]) => {
      new Manifest(path).updateFromData(manifestData)
    })
  }

  const dependenciesJson = '/tmp/dependencies.json'
  fs.writeFileSync(dependenciesJson, JSON.stringify(data))
  shell.exec(shellEscape(['deps', 'pullrequest', dependenciesJson]))
}
