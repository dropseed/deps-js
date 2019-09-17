import fs from 'fs'
import { Manifest } from './manifest'
import { Lockfile } from './lockfile'

export const act = (inputPath, outputPath) => {
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

  if (data.lockfiles) {
    Object.entries(data.lockfiles).forEach(([lockfilePath, lockfileData]) => {
      const lockfile = new Lockfile(lockfilePath)

      lockfile.generate()  // make sure current is actually installed (npm update doesn't work well otherwise)
      lockfile.update()

      lockfileData.updated = lockfile.convertToSchema()
    })
  }

  if (data.manifests) {
    Object.entries(data.manifests).forEach(([path, manifestData]) => {
      new Manifest(path).updateFromData(manifestData)
    })
  }

  fs.writeFileSync(outputPath, JSON.stringify(data))
}
