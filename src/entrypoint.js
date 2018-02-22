import path from 'path'
import fs from 'fs'
import shell from 'shelljs'
import { collect } from './collect'
import { act } from './act'
import { outputPackageJSON } from './utils'

shell.set('-e') // any failing shell commands will fail
shell.set('-v') // verbose

// set the NODE_ENV to the user's config setting
process.env.NODE_ENV = process.env.SETTING_NODE_ENV || 'development'

const NPMRC = process.env.SETTING_NPMRC
if (NPMRC) {
  console.log(
    '.npmrc contents found in settings, writing to /home/app/.npmrc...'
  )
  fs.writeFileSync('/home/app/.npmrc', NPMRC)
  console.log(NPMRC)
}

if (process.env.RUN_AS === 'collector') {
  console.log('Running as collector')
  const dependencyPath = process.argv[2]
  outputPackageJSON(dependencyPath)
  collect(dependencyPath)
} else if (process.env.RUN_AS === 'actor') {
  console.log('Running as actor')
  act()
}
