export const outputSchema = schema => {
  const begin = '<DependenciesSchema>'
  const end = '</DependenciesSchema>'
  // schema.version = '2.0.0'
  console.log(begin + JSON.stringify(schema) + end)
  // console.log(JSON.stringify(schema))
}
