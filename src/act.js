import fs from 'fs'
import shell from 'shelljs'
import { updateManifest } from './manifest'
import { Lockfile } from './lockfile'
import { createGitBranch, pushGitBranch } from './utils'
import { outputSchema } from './schema'

export const act = () => {
  console.log('Acting')

  const schemaFile = fs.readFileSync('/dependencies/schema.json', 'utf8')
  const schema = JSON.parse(schemaFile)

  if (schema.lockfiles) {

    // if batch mode do all lockfiles in 1 PR
    const batchMode = process.env.SETTING_BATCH_MODE == 'true'
    const batchModeBranchName = `update-lockfiles-build-${process.env.ACTOR_ID}`
    if (batchMode) createGitBranch(batchModeBranchName)

    Object.entries(schema.lockfiles).forEach(([path, schema]) => {
      console.log(path)
      console.log(schema)

      // TODO needs to have some lockfile identifier -- actor could do multiple
      const branchName = `lockfile-update-build-${process.env.ACTOR_ID}`

      if (!batchMode) createGitBranch(branchName)

      const lockfile = new Lockfile(path)
      lockfile.update()

      // any reason not to commit everything changed?
      shell.exec(`git add .`)
      const commitMessagePrefix = process.env.SETTING_COMMIT_MESSAGE_PREFIX || ''
      shell.exec(`git commit -m "${commitMessagePrefix}Update ${lockfile.path}"`)

      // TODO git commit, push, PR
      if (!batchMode) {
        pushGitBranch(branchName)

        // output the newly updated schema
        outputSchema({
          lockfiles: {
            [lockfile.path]: {
              current: lockfile.convertToLockfileSchema(),
            }
          }
        })
      }

      // if lockfile.can_be_updated
      // doesn't need all of the schema, can parse it if need be and
      // will contain the actual changes made

      // never have to worry about re-running this? or yes we do,
      // don't want to open/close a PR for the exact same changes
      // MD5 checksum of lockfile change that was sent? then collector can
      // skip if not different?
    })

    if (batchMode) {
      pushGitBranch(batchModeBranchName)

      // TODO output batch schema
    }
  }

  if (schema.manifests) {
    Object.entries(schema.manifests).forEach(([path, schema]) => {
      updateManifest(path, schema)
    })
  }
}
