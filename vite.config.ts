import type { BuildOptions, TerserOptions } from 'vite'

import { createRequire } from 'node:module'

import myBanner from '@cycjimmy/config-lib/esm/chore/myBanner.js'
import terserOption from '@cycjimmy/config-lib/esm/terser/4.x/production.js'
import autoprefixer from 'autoprefixer'
import { defineConfig } from 'vite'

interface PackageJsonMeta {
  module: string
  browser: string
  [key: string]: unknown
}

interface LibraryBuildOptions {
  formats: ('es' | 'umd')[]
  fileName: string
  minify?: false | 'terser'
}

const pkg = createRequire(import.meta.url)('./package.json') as PackageJsonMeta

// config-lib's shared option follows terser 4's legacy `output` key. Vite 8 always
// injects `format` and terser rejects having both, so convert `output` → `format`.
// The assertion is confined to this boundary because config-lib ships no types.
const { output, ...restTerserOption } = terserOption
const terserOptions = { ...restTerserOption, format: output } as TerserOptions

// Output file names follow the pkg field conventions of the old rollup configs.
const esmFileName = pkg.module.replace('dist/', '') // scroller.esm.js
const umdFileName = pkg.browser.replace('dist/', '').replace('.min.js', '.js') // scroller.umd.js
const umdMinFileName = pkg.browser.replace('dist/', '') // scroller.umd.min.js

function libBuild({ formats, fileName, minify = false }: LibraryBuildOptions): BuildOptions {
  return {
    target: 'es2015',
    outDir: 'dist',
    // Keep artifacts of previous incremental builds (`npm run build` cleans dist first).
    emptyOutDir: false,
    minify,
    ...(minify === 'terser' && { terserOptions }),
    lib: {
      entry: 'src/index.ts',
      // The UMD global stays `Scroller`, which the README and the demo page rely on.
      name: 'Scroller',
      formats,
      fileName: () => fileName,
    },
    rollupOptions: {
      output: {
        exports: 'default',
        // Only the CDN build carries the banner; it is added after minification.
        ...(minify === 'terser' && {
          banner: myBanner(pkg),
        }),
      },
    },
  }
}

const builds: Partial<Record<string, BuildOptions>> = {
  'esm': libBuild({
    formats: ['es'],
    fileName: esmFileName,
  }),
  'umd': libBuild({
    formats: ['umd'],
    fileName: umdFileName,
  }),
  'umd-min': libBuild({
    formats: ['umd'],
    fileName: umdMinFileName,
    minify: 'terser',
  }),
}

// The Pages demo is a normal HTML build of static/index.html that imports src, so
// the dev server and the deployed site share one page. `root: 'static'` (set
// below) makes outDir resolve to .publish/ and drops index.html at the artifact
// root, where Pages serves it from.
const deploymentBuild: BuildOptions = {
  outDir: '../.publish',
  emptyOutDir: true,
  target: 'es2015',
}

export default defineConfig(({ mode }) => {
  const isDeployment = mode === 'deployment'
  const build = builds[mode]

  return {
    // Building from static/ keeps the deployed HTML at the artifact root.
    ...(isDeployment && { root: 'static' }),
    // Relative URLs keep the demo working under the repository subpath.
    ...(isDeployment && { base: './' }),
    // Avoid copying static/ (or any public dir) into dist and polluting .release.
    publicDir: false,
    // The dev entry lives in static/, so point `vite` at it instead of 404ing on /.
    server: {
      open: '/static/index.html',
    },
    css: {
      // Inline postcss config keeps the build setup in a single file.
      postcss: {
        plugins: [autoprefixer],
      },
    },
    ...(isDeployment
      ? { build: deploymentBuild }
      : (build && { build })),
  }
})
