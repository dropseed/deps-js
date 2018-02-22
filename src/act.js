import fs from 'fs'
import shell from 'shelljs'
import shellEscape from 'shell-escape'
import { updateManifest } from './manifest'
import { Lockfile } from './lockfile'

export const act = () => {
  console.log('Acting')

  const data = JSON.parse(fs.readFileSync('/dependencies/input_data.json', 'utf8'))

  shell.exec("deps branch")

  if (data.lockfiles) {
    Object.entries(data.lockfiles).forEach(([path, lockfileData]) => {
      const lockfile = new Lockfile(path)
      lockfile.update()

      // commit everything that was changed (scripts may have updated other files)
      shell.exec(`deps commit -m "Update ${lockfile.path}" .`)

      lockfileData.updated = lockfile.convertToLockfileSchema()
    })
  }

  if (data.manifests) {
    Object.entries(data.manifests).forEach(([path, manifestData]) => {
      updateManifest(path, manifestData)
    })
  }

  const dependenciesJson = '/tmp/dependencies.json'
  fs.writeFileSync(dependenciesJson, JSON.stringify(data))
  shell.exec(shellEscape(['deps', 'pullrequest', dependenciesJson]))
}
