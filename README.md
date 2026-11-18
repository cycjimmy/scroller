# Scroller

[![Test CI][workflows-badge-image]][workflows-url]
[![libraries dependency status][libraries-status-image]][libraries-status-url]
[![libraries sourcerank][libraries-sourcerank-image]][libraries-sourcerank-url]
[![Release date][release-date-image]][release-url]
[![vite][vite-image]][vite-url]
[![semantic-release][semantic-image]][semantic-url]
[![vitest][vitest-image]][vitest-url]
[![npm license][license-image]][download-url]

A pure logic component for scrolling/zooming. It is independent of any specific kind of rendering or event system.

This repository has been forked from [Zynga/Scroller](https://github.com/pbakaus/scroller). It is written in TypeScript and ships an ESM entry plus UMD builds. ([Demo][github-pages-url])

## Features

- Customizable enabling/disabling of scrolling for x-axis and y-axis
- Deceleration (decelerates when user action ends in motion)
- Bouncing (bounces back on the edges)
- Paging (snap to full page width/height)
- Snapping (snap to an user definable pixel grid)
- Zooming (automatic centered zooming or based on a point in the view with configurable min/max zoom)
- Locking (locks drag direction based on initial movement)
- Pull-to-Refresh (Pull top out of the boundaries to start refresh of list)
- Configurable regarding whether animation should be used.

## Install

[![NPM version][npm-image]][npm-url]
[![NPM bundle size][npm-bundle-size-image]][npm-url]
[![npm download][download-image]][download-url]

```shell
# via npm
$ npm install @cycjimmy/scroller --save

# or via yarn
$ yarn add @cycjimmy/scroller
```

## Module format

The package is **ESM only**:

| File | Format | Purpose |
| --- | --- | --- |
| `dist/scroller.esm.js` | ESM | `main`, `module` and `exports` entry (bundlers, `import`) |
| `dist/scroller.umd.js` | UMD | unminified browser build for `<script>` tags |
| `dist/scroller.umd.min.js` | UMD | minified browser/CDN build, `browser`/`unpkg`/`jsdelivr` |
| `dist/index.d.ts` | Types | TypeScript declarations for `types` and the `exports` `types` condition |

- There is no CommonJS bundle. Node.js 20.19+ / 22.12+ can `require()` the ESM entry, because those versions load an ES module synchronously.
- `browser`, `unpkg` and `jsdelivr` point at the minified UMD build for plain `<script>` tags and CDNs. No `browser` condition is declared in `exports` on purpose: bundlers always resolve the ESM entry, so the UMD bundle is never bundled into an application.
- The bundles target ES2015, so Internet Explorer is no longer supported.
- Type declarations ship with the package, so no `@types/*` package is needed.
- There are no runtime dependencies, and no stylesheet to load: the component only computes positions, the rendering stays with the host page.

The toolchain itself needs Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` (see `engines` in `package.json` and the requirements in [CONTRIBUTING.md](CONTRIBUTING.md)).

## Usage

Callback (first parameter of constructor) is required. Options are optional. Defaults are listed below. The created instance must have proper dimensions using a `setDimensions()` call. Afterwards you can pass in event data or manually control scrolling/zooming via the API.

```ts
import Scroller from '@cycjimmy/scroller'

const scrollerObj = new Scroller((left, top, zoom) => {
  // apply coordinates/zooming
}, {
  scrollingY: false,
})

// Configure to have an outer dimension of 1000px and inner dimension of 3000px
scrollerObj.setDimensions(1000, 1000, 3000, 3000)
```

## Options

These are the available options with their defaults. Options can be modified using the second constructor parameter or during runtime by modification of `scrollerObj.options.optionName`.

- scrollingX = `true`
- scrollingY = `true`
- animating = `true`
- animationDuration = `250`
- bouncing = `true`
- locking = `true`
- paging = `false`
- snapping = `false`
- zooming = `false`
- minZoom = `0.5`
- maxZoom = `3`
- speedMultiplier = `1`
- scrollingComplete = `() => {}`
- penetrationDeceleration = `0.03`
- penetrationAcceleration = `0.08`

## Public API

- Setup scroll object dimensions.  
  `scrollerObj.setDimensions(clientWidth, clientHeight, contentWidth, contentHeight)`
- Setup scroll object position (in relation to the document). Required for zooming to event position (mousewheel, touchmove).  
  `scrollerObj.setPosition(clientLeft, clientTop)`
- Setup snap dimensions (only needed when `snapping` is enabled).  
  `scrollerObj.setSnapSize(width, height)`
- Setup pull-to-refresh. Height of the info region plus three callbacks which are executed on the different stages.  
  `scrollerObj.activatePullToRefresh(height, activate, deactivate, start)`
- Stop pull-to-refresh session. Called inside the logic started by start callback for activatePullToRefresh call.  
  `scrollerObj.finishPullToRefresh()`
- Get current scroll positions and zooming.  
  `scrollerObj.getValues() => { left, top, zoom }`
- Get the maximum scroll positions.  
  `scrollerObj.getScrollMax() => { left, top }`
- Zoom to a specific level. Origin defines the pixel position where zooming should centering to. Defaults to center of scrollerObj.  
  `scrollerObj.zoomTo(level, animate ? false, originLeft ? center, originTop ? center, callback ? null)`
- Zoom by a given amount. Same as `zoomTo` but by a relative value.  
  `scrollerObj.zoomBy(factor, animate ? false, originLeft ? center, originTop ? center, callback ? null)`
- Scroll to a specific position.  
  `scrollerObj.scrollTo(left, top, animate ? false, zoom ? null)`
- Scroll by the given amount.  
  `scrollerObj.scrollBy(leftOffset, topOffset, animate ? false)`

## Event API

This API part can be used to pass event data to the `scrollerObj` to react on user actions.

- `doMouseZoom(wheelDelta, timeStamp, pageX, pageY)`
- `doTouchStart(touches, timeStamp)`
- `doTouchMove(touches, timeStamp, scale)`
- `doTouchEnd(timeStamp)`

For a touch device just pass the native `touches` event data to the doTouch\* methods. On mouse systems one can emulate this data using an array with just one element:

- Touch device: `doTouchMove(e.touches, e.timeStamp)`
- Mouse device: `doTouchMove([e], e.timeStamp)`

To zoom using the `mousewheel` event just pass the data like this:

- `doMouseZoom(e.wheelDelta, e.timeStamp, e.pageX, e.pageY)`

The `timeStamp` argument accepts a number or a `Date`. For more information about this please take a look at the demo.

## Demos

See Zynga/Scroller demos online here: <http://zynga.github.com/scroller/>

The page in `static/` is both the development entry and the deployed demo: it imports `src/` directly, so `npm run dev` and the GitHub Pages build render the same file.

## CDN

[![jsdelivr][jsdelivr-image]][jsdelivr-url]

To use via a CDN include this in your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/@cycjimmy/scroller@4/dist/scroller.umd.min.js"></script>
```

The UMD build exposes the constructor as the global `Scroller`.

## License

MIT © 2020-2022 cycjimmy and 2011 Zynga

<!-- Links: -->

[npm-image]: https://img.shields.io/npm/v/@cycjimmy/scroller
[npm-url]: https://npmjs.org/package/@cycjimmy/scroller
[npm-bundle-size-image]: https://img.shields.io/bundlephobia/min/@cycjimmy/scroller

[download-image]: https://img.shields.io/npm/dt/@cycjimmy/scroller
[download-url]: https://npmjs.org/package/@cycjimmy/scroller

[jsdelivr-image]: https://img.shields.io/jsdelivr/npm/hy/@cycjimmy/scroller
[jsdelivr-url]: https://www.jsdelivr.com/package/npm/@cycjimmy/scroller

[workflows-badge-image]: https://github.com/cycjimmy/scroller/workflows/Test%20CI/badge.svg
[workflows-url]: https://github.com/cycjimmy/scroller/actions/workflows/nodeTestCI.yml

[libraries-status-image]: https://img.shields.io/librariesio/release/npm/@cycjimmy/scroller
[libraries-sourcerank-image]: https://img.shields.io/librariesio/sourcerank/npm/@cycjimmy/scroller
[libraries-status-url]: https://libraries.io/github/cycjimmy/scroller
[libraries-sourcerank-url]: https://libraries.io/npm/@cycjimmy%2Fscroller

[release-date-image]: https://img.shields.io/github/release-date/cycjimmy/scroller
[release-url]: https://github.com/cycjimmy/scroller/releases

[vite-image]: https://img.shields.io/github/package-json/dependency-version/cycjimmy/scroller/dev/vite
[vite-url]: https://vite.dev

[semantic-image]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%20%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-url]: https://github.com/semantic-release/semantic-release

[vitest-image]: https://img.shields.io/badge/tested_with-vitest-6e9f18.svg
[vitest-url]: https://vitest.dev

[license-image]: https://img.shields.io/npm/l/@cycjimmy/scroller

[github-pages-url]: https://cycjimmy.github.io/scroller/
