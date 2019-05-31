import shell from 'shelljs'
import { collect } from './collect'
import { act } from './act'

shell.set('-e') // any failing shell commands will fail
shell.set('-v') // verbose

if (process.env.RUN_AS === 'collector') {
  collect(process.argv[2], process.argv[3])
} else if (process.env.RUN_AS === 'actor') {
  act(process.argv[2], process.argv[3])
}
