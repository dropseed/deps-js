import fs from 'fs'
import shell from 'shelljs'
import shellEscape from 'shell-escape'
import { updateManifest } from './manifest'
import { Lockfile } from './lockfile'
import { createGitBranch, pushGitBranch } from './utils'
import { outputActions } from './schema'

export const act = () => {
  console.log('Acting')

  const data = JSON.parse(fs.readFileSync('/dependencies/input_data.json', 'utf8'))

  const branchName = `deps/update-job-${process.env.JOB_ID}`
  createGitBranch(branchName)

  if (data.lockfiles) {
    Object.entries(data.lockfiles).forEach(([path, lockfileData]) => {
      const lockfile = new Lockfile(path)
      lockfile.update()

      // commit everything that was changed (scripts may have updated other files)
      shell.exec(`git add .`)
      const commitMessagePrefix = process.env.SETTING_COMMIT_MESSAGE_PREFIX || ''
      shell.exec(`git commit -m "${commitMessagePrefix}Update ${lockfile.path}"`)

      lockfileData.updated = lockfile.convertToLockfileSchema()
    })
  }

  if (data.manifests) {
    Object.entries(data.manifests).forEach(([path, manifestData]) => {
      updateManifest(path, manifestData)
    })
  }

  pushGitBranch(branchName)
  const dependenciesJson = '/tmp/dependencies.json'
  fs.writeFileSync(dependenciesJson, JSON.stringify(data))
  shell.exec(shellEscape(['pullrequest', '--branch', branchName, '--dependencies-json', dependenciesJson]))
}
