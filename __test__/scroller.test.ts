import type { ScrollerOptions } from '../src/index.js'
import { describe, expect, it, vi } from 'vitest'

import Scroller from '../src/index.js'

/**
 * `animating: false` keeps every publish synchronous, so the assertions below
 * only observe the scroll model and never wait for a frame.
 */
function createScroller(options: ScrollerOptions = {}): Scroller {
  return new Scroller(() => {}, { animating: false, ...options })
}

describe('options', () => {
  it('exposes the documented defaults', () => {
    const { options } = new Scroller(() => {})

    expect(options).toMatchObject({
      scrollingX: true,
      scrollingY: true,
      animating: true,
      animationDuration: 250,
      bouncing: true,
      locking: true,
      paging: false,
      snapping: false,
      zooming: false,
      minZoom: 0.5,
      maxZoom: 3,
      speedMultiplier: 1,
      penetrationDeceleration: 0.03,
      penetrationAcceleration: 0.08,
    })
  })

  it('merges the constructor options over the defaults', () => {
    const { options } = createScroller({ scrollingY: false, minZoom: 1 })

    expect(options.scrollingY).toBe(false)
    expect(options.minZoom).toBe(1)
    expect(options.scrollingX).toBe(true)
  })
})

describe('dimensions and position', () => {
  it('starts at the origin with a zoom level of 1', () => {
    expect(createScroller().getValues()).toEqual({ left: 0, top: 0, zoom: 1 })
  })

  it('recomputes the maximum scroll position', () => {
    const scroller = createScroller()

    scroller.setDimensions(100, 100, 300, 300)

    expect(scroller.getScrollMax()).toEqual({ left: 200, top: 200 })
  })

  it('updates only the dimensions that are passed', () => {
    const scroller = createScroller()
    scroller.setDimensions(100, 100, 300, 300)

    scroller.setDimensions(null, null, null, 800)

    expect(scroller.getScrollMax()).toEqual({ left: 200, top: 700 })
  })

  it('clamps a scrollTo target into the allowed range', () => {
    const scroller = createScroller()
    scroller.setDimensions(100, 100, 300, 300)

    scroller.scrollTo(999, -5, false)

    expect(scroller.getValues()).toMatchObject({ left: 200, top: 0 })
  })

  it('keeps the current axis when scrolling is disabled for it', () => {
    const scroller = createScroller({ scrollingX: false })
    scroller.setDimensions(100, 100, 300, 300)

    scroller.scrollTo(100, 100, false)

    expect(scroller.getValues()).toMatchObject({ left: 0, top: 100 })
  })
})

describe('paging and snapping', () => {
  it('snaps to full pages when paging is enabled', () => {
    const scroller = createScroller({ paging: true })
    scroller.setDimensions(100, 100, 300, 300)

    scroller.scrollTo(140, 260, false)

    // 140 → page 1, 260 → page 3, clamped to the maximum page 2
    expect(scroller.getValues()).toMatchObject({ left: 100, top: 200 })
  })

  it('snaps to the configured grid when snapping is enabled', () => {
    const scroller = createScroller({ snapping: true })
    scroller.setDimensions(100, 100, 300, 300)
    scroller.setSnapSize(50, 50)

    scroller.scrollTo(120, 70, false)

    expect(scroller.getValues()).toMatchObject({ left: 100, top: 50 })
  })
})

describe('zooming', () => {
  it('throws when zooming is disabled', () => {
    const scroller = createScroller()
    scroller.setDimensions(100, 100, 300, 300)

    expect(() => scroller.zoomTo(2)).toThrow('Zooming is not enabled!')
    expect(() => scroller.scrollTo(0, 0, false, 2)).toThrow('Zooming is not enabled!')
  })

  it('clamps the level to minZoom/maxZoom and reports the new values', () => {
    const onZoomComplete = vi.fn()
    const scroller = createScroller({ zooming: true })
    scroller.setDimensions(100, 100, 300, 300)

    scroller.zoomTo(10, false, undefined, undefined, onZoomComplete)

    expect(scroller.getValues().zoom).toBe(3)
    expect(onZoomComplete).toHaveBeenCalledTimes(1)
  })

  it('applies the factor of zoomBy', () => {
    const scroller = createScroller({ zooming: true, maxZoom: 10 })
    scroller.setDimensions(100, 100, 300, 300)

    scroller.zoomBy(2, false)
    expect(scroller.getValues().zoom).toBe(2)

    scroller.zoomBy(0.5, false)
    expect(scroller.getValues().zoom).toBe(1)
  })

  it('keeps the last pinch ratio when a move carries no scale', () => {
    const scroller = createScroller({ zooming: true, maxZoom: 10 })
    const touches = [
      { pageX: 0, pageY: 0 },
      { pageX: 100, pageY: 100 },
    ]

    scroller.doTouchStart(touches, 0)

    scroller.doTouchMove(touches, 16, 2)
    expect(scroller.getValues().zoom).toBe(2)

    // A mouse-style move carries no scale and must not reset the ratio
    scroller.doTouchMove(touches, 32)
    expect(scroller.getValues().zoom).toBe(2)

    // The same pinch ratio must not be applied twice
    scroller.doTouchMove(touches, 48, 2)
    expect(scroller.getValues().zoom).toBe(2)
  })
})

describe('scrollBy', () => {
  it('adds the offset to the current position', () => {
    const scroller = createScroller()
    scroller.setDimensions(100, 100, 300, 300)

    scroller.scrollTo(10, 10, false)
    scroller.scrollBy(20, 30, false)

    expect(scroller.getValues()).toMatchObject({ left: 30, top: 40 })
  })
})

describe('event input validation', () => {
  it('rejects a touch list without a length', () => {
    const scroller = createScroller()

    expect(() => scroller.doTouchStart({} as never, 0)).toThrow('Invalid touch list')
    expect(() => scroller.doTouchMove({} as never, 0)).toThrow('Invalid touch list')
  })

  it('rejects a timestamp that is neither a number nor a Date', () => {
    const scroller = createScroller()

    expect(() => scroller.doTouchStart([
      { pageX: 0, pageY: 0 },
    ], 'now' as never))
      .toThrow('Invalid timestamp value')
    expect(() => scroller.doTouchEnd('now' as never)).toThrow('Invalid timestamp value')
  })

  it('accepts a Date as timestamp', () => {
    const scroller = createScroller()

    expect(() => scroller.doTouchStart([
      { pageX: 0, pageY: 0 },
    ], new Date())).not.toThrow()
    expect(() => scroller.doTouchEnd(new Date())).not.toThrow()
  })
})

/**
 * These calls double as type assertions: `tsc` rejects them if a declaration
 * narrows a parameter that the runtime (and the README) accepts.
 */
describe('documented argument shapes', () => {
  it('accepts null origins, a Date wheel timestamp and partial dimensions', () => {
    const scroller = createScroller({ zooming: true, maxZoom: 10 })

    // A `null` dimension keeps the previous value
    expect(() => scroller.setDimensions(null, null, null, 800)).not.toThrow()
    expect(scroller.getScrollMax()).toEqual({ left: 0, top: 800 })

    // `null` origins mean "center of the viewport" for both zoom entry points
    expect(() => scroller.zoomBy(2, false, null, null)).not.toThrow()
    expect(scroller.getValues().zoom).toBe(2)

    // A Date is accepted wherever the API takes a timestamp, including the wheel
    expect(() => scroller.doMouseZoom(1, new Date(), 0, 0)).not.toThrow()
  })

  it('accepts a null zoom callback and nullable scrollBy offsets', () => {
    const scroller = createScroller({ zooming: true })
    scroller.setDimensions(100, 100, 300, 300)

    // The README documents the callback as `null` by default
    expect(() => scroller.zoomTo(2, false, undefined, undefined, null)).not.toThrow()
    expect(() => scroller.zoomBy(1, false, null, null, null)).not.toThrow()

    // A missing offset means 0, exactly like the v3 JSDoc promised
    const before = scroller.getValues()
    expect(() => scroller.scrollBy(null, 10, false)).not.toThrow()
    const after = scroller.getValues()
    expect(after.left).toBe(before.left)
    expect(after.top).toBe(before.top + 10)
  })
})
