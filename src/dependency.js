import shell from 'shelljs'

export const getInstalledVersionOfDependency = (name) => {
  try {
    const data = JSON.parse(
      shell
        .exec(`npm ls ${name} --depth=0 --json`, { silent: true })
        .stdout.trim()
    )
    return data.dependencies[name].version
  } catch (e) {
    console.log(e)
    return null
  }
}
