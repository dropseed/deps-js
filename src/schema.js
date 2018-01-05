export const outputDependencies = schema => {
  const begin = '<Dependencies>'
  const end = '</Dependencies>'
  // schema.version = '2.0.0'
  console.log(begin + JSON.stringify(schema) + end)
  // console.log(JSON.stringify(schema))
}

export const outputActions = schema => {
  const begin = '<Actions>'
  const end = '</Actions>'
  console.log(begin + JSON.stringify(schema) + end)
}
