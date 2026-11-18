/* eslint no-console: 0 */
import path from 'node:path'

import fs from 'fs-extra'

const { readJsonSync, outputJsonSync } = fs

interface ReleasePackageJson {
  scripts?: unknown
  dependencies?: unknown
  devDependencies?: unknown
  engines?: unknown
  config?: unknown
  publishConfig?: { access?: string }
  [key: string]: unknown
}

const jsonData = readJsonSync(
  path.resolve('package.json'),
) as ReleasePackageJson

if (jsonData.scripts) {
  delete jsonData.scripts
}

if (jsonData.dependencies) {
  delete jsonData.dependencies
}

if (jsonData.devDependencies) {
  delete jsonData.devDependencies
}

// `engines` describes the toolchain of this repository, not the runtime the
// browser bundles need, so it must not reach the published package.
if (jsonData.engines) {
  delete jsonData.engines
}

// A scoped package without `publishConfig.access` is published as `restricted`:
// keep the access level only, the registry and tag are decided by the release
// tooling.
jsonData.publishConfig = {
  access: jsonData.publishConfig?.access ?? 'public',
}

if (jsonData.config) {
  delete jsonData.config
}

outputJsonSync(
  path.resolve('.release', 'package.json'),
  jsonData,
  {
    spaces: 2,
  },
)

console.log('handlePackageJson success!')
