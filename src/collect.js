import fs from 'fs'
import shell from 'shelljs'
import shellEscape from 'shell-escape'
import { Lockfile } from './lockfile'
import { Manifest } from './manifest'


export const collect = dependencyPath => {

  shell.exec("deps hook before_update")

  let output = {manifests: {}}

  // find the manifest(s)
  const manifests = Manifest.manifestsInPath(dependencyPath)
  manifests.forEach(m => {
    output.manifests[m.path] = m.convertToSchema()
  })

  // add the lockfiles
  const lockfile = new Lockfile(dependencyPath)
  if (lockfile.existed) {
    const originalSchema = lockfile.convertToSchema()

    output.lockfiles = {
      [lockfile.path]: {
        current: originalSchema,
      },
    }

    lockfile.update()
    const updatedSchema = lockfile.convertToSchema()
    if (updatedSchema.fingerprint !== originalSchema.fingerprint) {
      // only include in output if the file actually changed
      output.lockfiles[lockfile.path].updated = updatedSchema
    }

    // point all the manifests back to this lockfile (yarn workspaces)
    Object.keys(output.manifests).forEach(name => output.manifests[name].lockfile_path = lockfile.path)
  }

  // report the reuslts
  const dependenciesJson = '/tmp/collected.json'
  fs.writeFileSync(dependenciesJson, JSON.stringify(output))
  shell.exec(shellEscape(['deps', 'collect', dependenciesJson]))
}
