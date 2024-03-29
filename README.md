# deps-js

Currently supports:

- `package.json`
- `package-lock.json`
- `yarn.lock`

## Example `deps.yml`

```yaml
version: 3
dependencies:
- type: js
  path: app  # a directory
  settings:
    # Enable updates for specific kinds of dependencies
    # in package.json.
    #
    # Default: [dependencies, devDependencies]
    manifest_package_types:
    - dependencies
```

![yarn.lock deps pull request example](https://user-images.githubusercontent.com/649496/136111016-480de2d8-5ede-4dc0-90a4-201df83249da.png)

Most of the time, the lockfile updates will account for your "grouped" dependencies that need to be updated together (since those updates are usually all within your package.json ranges). But you can also group out-of-range package.json updates by using [filters](https://deps.app/config/#grouping-related-updates).

```yaml
version: 3
dependencies:
- type: js
  path: app
  manifest_updates:
    filters:
    - name: remark-lint-.*
      group: true
    - name: .*
      group: false
```

## Support

Any questions or issues with this specific component should be discussed in [GitHub issues](https://github.com/dropseed/deps-js/issues).

If there is private information which needs to be shared then please use the private support channels in [dependencies.io](https://www.dependencies.io/contact/).
