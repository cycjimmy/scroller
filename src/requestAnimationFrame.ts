/** Callback invoked before the next repaint. */
export type FrameCallback = (time: number) => void

/** Schedules a repaint and returns a handle the environment may ignore. */
export type RequestFrame = (callback: FrameCallback, root?: HTMLElement) => void

/** Vendor prefixed implementations, still shipped by older WebViews. */
interface VendorPrefixedWindow extends Window {
  webkitRequestAnimationFrame?: typeof globalThis.window.requestAnimationFrame
  mozRequestAnimationFrame?: typeof globalThis.window.requestAnimationFrame
  oRequestAnimationFrame?: typeof globalThis.window.requestAnimationFrame
}

const TARGET_FPS = 60
const IDLE_TIMEOUT = 2500

/**
 * Timeout based scheduler, used when the environment has no usable
 * `requestAnimationFrame` and when the module is loaded outside a DOM (SSR,
 * Node), where `window` does not exist at all.
 */
function createTimeoutScheduler(): RequestFrame {
  let requests: Record<number, FrameCallback> = {}
  let rafHandle = 1
  let intervalHandle: ReturnType<typeof setInterval> | null = null
  let lastActive = Date.now()

  return (callback) => {
    const callbackHandle = rafHandle
    rafHandle += 1

    requests[callbackHandle] = callback

    if (intervalHandle === null) {
      intervalHandle = setInterval(() => {
        const time = Date.now()
        const currentRequests = requests

        // Reset data structure before executing callbacks
        requests = {}

        Object.values(currentRequests).forEach((currentCallback) => {
          currentCallback(time)
          lastActive = time
        })

        // Disable the timeout when nothing happens for a certain
        // period of time
        const currentHandle = intervalHandle
        if (currentHandle !== null && time - lastActive > IDLE_TIMEOUT) {
          clearInterval(currentHandle)
          intervalHandle = null
        }
      }, 1000 / TARGET_FPS)
    }
  }
}

/**
 * A requestAnimationFrame wrapper / polyfill.
 *
 * @param callback The callback to be invoked before the next repaint.
 * @param root The root element for the repaint
 */
const requestAnimationFrame = ((): RequestFrame => {
  if (typeof window === 'undefined') {
    return createTimeoutScheduler()
  }

  // Check for request animation Frame support
  const prefixedWindow = window as VendorPrefixedWindow
  const nativeRequestFrame = window.requestAnimationFrame
    || prefixedWindow.webkitRequestAnimationFrame
    || prefixedWindow.mozRequestAnimationFrame
    || prefixedWindow.oRequestAnimationFrame

  if (!nativeRequestFrame) {
    return createTimeoutScheduler()
  }

  // A polyfill installed by another library is not trusted with the `root`
  // argument, so the built-in scheduler is used instead.
  const isNative = /requestAnimationFrame\(\)\s*\{\s*\[native code\]\s*\}/i
    .test(nativeRequestFrame.toString())

  if (!isNative) {
    return createTimeoutScheduler()
  }

  return (callback, root) => {
    // The second argument is an element-scoped extension understood by some
    // engines; the standard signature ignores it.
    (nativeRequestFrame as (cb: FrameRequestCallback, element?: HTMLElement) => number)(callback, root)
  }
})()

export default requestAnimationFrame
