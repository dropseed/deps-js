# js [![Build Status](https://travis-ci.org/dependencies-io/js.svg?branch=master)](https://travis-ci.org/dependencies-io/js)

A [dependencies.io](https://www.dependencies.io) component for updating javascript dependencies using npm or yarn.

## Usage

Set the `path` to a directory containing a package.json and optional lockfiles. Both package-lock.json and yarn.lock are supported, and will be detected automatically. Yarn workspaces are also supported and the package.json for each workspace will be included.

```yml
version: 2
dependencies:
- type: js
  path: app
  settings:
    # set the NODE_ENV env variable
    # default: development
    node_env: production
  
    # contents to put in ~/.npmrc
    # default: none
    npmrc: |
      registry=https://skimdb.npmjs.com/registry
  
    # by default we'll collect the package.json versions under the "latest" dist-tag (default npm behavior)
    # if you want to follow a specific dist-tag (like "next" or "unstable"), then you
    # can specify that here by the package name
    # default: none
    dist_tags:
      semantic-release: next
```

There are also [additional settings available](https://github.com/dependencies-io/deps#dependenciesyml) for
further customizing how updates are made.

## Resources

- https://devcenter.heroku.com/articles/node-best-practices

## Support

Any questions or issues with this specific actor should be discussed in [GitHub
issues](https://github.com/dependencies-io/js/issues). If there is
private information which needs to be shared then you can instead use the
private support channels in dependencies.io.
