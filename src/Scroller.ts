/**
 * Scroller
 * http://github.com/cycjimmy/scroller
 *
 * Based on zynga/scroller
 * http://github.com/zynga/scroller
 * Copyright 2011, Zynga Inc.
 * Licensed under the MIT License.
 */

import Animate from './Animate.js'
import { easeInOutCubic, easeOutCubic } from './easing.js'

/** Receives the new scroll position and zoom level on every publish. */
export type ScrollCallback = (left: number, top: number, zoom: number) => void

/** Options the instance runs with; they can be changed at runtime. */
export interface ScrollOptions {
  /** Enable scrolling on x-axis */
  scrollingX: boolean
  /** Enable scrolling on y-axis */
  scrollingY: boolean
  /** Enable animations for deceleration, snap back, zooming and scrolling */
  animating: boolean
  /** Duration for animations triggered by scrollTo/zoomTo */
  animationDuration: number
  /** Enable bouncing (content can be slowly moved outside and jumps back after releasing) */
  bouncing: boolean
  /** Enable locking to the main axis if user moves only slightly on one of them at start */
  locking: boolean
  /** Enable pagination mode (switching between full page content panes) */
  paging: boolean
  /** Enable snapping of content to a configured pixel grid */
  snapping: boolean
  /** Enable zooming of content via API, fingers and mouse wheel */
  zooming: boolean
  /** Minimum zoom level */
  minZoom: number
  /** Maximum zoom level */
  maxZoom: number
  /** Multiply or decrease scrolling speed */
  speedMultiplier: number
  /**
   * Callback that is fired on the later of touch end or deceleration end,
   * provided that another scrolling action has not begun. Used to know
   * when to fade out a scrollbar.
   */
  scrollingComplete: () => void
  /**
   * This configures the amount of change applied to deceleration
   * when reaching boundaries
   */
  penetrationDeceleration: number
  /**
   * This configures the amount of change applied to acceleration
   * when reaching boundaries
   */
  penetrationAcceleration: number
}

/** Constructor options; every option is optional and keeps its default. */
export type ScrollerOptions = Partial<ScrollOptions>

/** Current scroll position and zoom level. */
export interface ScrollerValues {
  left: number
  top: number
  zoom: number
}

/** Maximum scroll position on both axes. */
export interface ScrollMax {
  left: number
  top: number
}

/** A single pointer position, as found in a native `Touch`. */
export interface TouchPoint {
  pageX: number
  pageY: number
}

/** Array-like list of pointers: a native `TouchList` or `[e]` for mouse input. */
export type TouchList = ArrayLike<TouchPoint>

/** Native event timestamp, or a `Date` for hand-built events. */
export type TimeStamp = number | Date

function NOOP(): void {}

/**
 * Whether the caller actually passed a usable size. `null`, `undefined` and
 * `NaN` keep the previous dimension, which is what the public API promises.
 */
function isDefinedNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && value === +value
}

/**
 * A pure logic 'component' for 'virtual' scrolling/zooming.
 */
export default class Scroller {
  animate: Animate

  options: ScrollOptions

  /**
   * ---------------------------------------------------------------------------
   * INTERNAL FIELDS :: STATUS
   * ---------------------------------------------------------------------------
   */
  /** Whether only a single finger is used in touch handling */
  __isSingleTouch = false

  /** Whether a touch event sequence is in progress */
  __isTracking = false

  /** Whether a deceleration animation went to completion. */
  __didDecelerationComplete = false

  /**
   * Whether a gesture zoom/rotate event is in progress. Activates when
   * a gesturestart event happens. This has higher priority than dragging.
   */
  __isGesturing = false

  /**
   * Whether the user has moved by such a distance that we have enabled
   * dragging mode. Hint: It's only enabled after some pixels of movement to
   * not interrupt with clicks etc.
   */
  __isDragging = false

  /**
   * Not touching and dragging anymore, and smoothly animating the
   * touch sequence using deceleration.
   */
  __isDecelerating: number | false = false

  /** Smoothly animating the currently configured change */
  __isAnimating: number | false = false

  /**
   * ---------------------------------------------------------------------------
   * INTERNAL FIELDS :: DIMENSIONS
   * ---------------------------------------------------------------------------
   */
  /** Available outer left position (from document perspective) */
  __clientLeft = 0

  /** Available outer top position (from document perspective) */
  __clientTop = 0

  /** Available outer width */
  __clientWidth = 0

  /** Available outer height */
  __clientHeight = 0

  /** Outer width of content */
  __contentWidth = 0

  /** Outer height of content */
  __contentHeight = 0

  /** Snapping width for content */
  __snapWidth = 100

  /** Snapping height for content */
  __snapHeight = 100

  /** Height to assign to refresh area */
  __refreshHeight: number | null = null

  /** Whether the refresh process is enabled when the event is released now */
  __refreshActive = false

  /**
   * Callback to execute on activation.
   * This is for signalling the user about a refresh is about to happen when he release
   */
  __refreshActivate: (() => void) | null = null

  /**
   * Callback to execute on deactivation.
   * This is for signalling the user about the refresh being cancelled
   */
  __refreshDeactivate: (() => void) | null = null

  /**
   * Callback to execute to start the actual refresh.
   * Call {@link finishPullToRefresh} when done
   */
  __refreshStart: (() => void) | null = null

  /** Zoom level */
  __zoomLevel = 1

  /** Scroll position on x-axis */
  __scrollLeft = 0

  /** Scroll position on y-axis */
  __scrollTop = 0

  /** Maximum allowed scroll position on x-axis */
  __maxScrollLeft = 0

  /** Maximum allowed scroll position on y-axis */
  __maxScrollTop = 0

  /** Scheduled left position (final position when animating) */
  __scheduledLeft = 0

  /** Scheduled top position (final position when animating) */
  __scheduledTop = 0

  /** Scheduled zoom level (final scale when animating) */
  __scheduledZoom = 0

  /**
   * ---------------------------------------------------------------------------
   * INTERNAL FIELDS :: LAST POSITIONS
   * ---------------------------------------------------------------------------
   */
  /** Left position of finger at start */
  __lastTouchLeft = 0

  /** Top position of finger at start */
  __lastTouchTop = 0

  /**
   * Timestamp of last move of finger.
   * Used to limit tracking range for deceleration speed.
   */
  __lastTouchMove = 0

  /** List of positions, uses three indexes for each state: left, top, timestamp */
  __positions: number[] = []

  /**
   * ---------------------------------------------------------------------------
   * INTERNAL FIELDS :: DECELERATION SUPPORT
   * ---------------------------------------------------------------------------
   */
  /** Minimum left scroll position during deceleration */
  __minDecelerationScrollLeft = 0

  /** Minimum top scroll position during deceleration */
  __minDecelerationScrollTop = 0

  /** Maximum left scroll position during deceleration */
  __maxDecelerationScrollLeft = 0

  /** Maximum top scroll position during deceleration */
  __maxDecelerationScrollTop = 0

  /** Current factor to modify horizontal scroll position with on every step */
  __decelerationVelocityX = 0

  /** Current factor to modify vertical scroll position with on every step */
  __decelerationVelocityY = 0

  /**
   * ---------------------------------------------------------------------------
   * INTERNAL FIELDS :: TOUCH TRACKING
   * ---------------------------------------------------------------------------
   */
  /** Left position of the first touch of the sequence */
  __initialTouchLeft = 0

  /** Top position of the first touch of the sequence */
  __initialTouchTop = 0

  /** Zoom level when the touch sequence started */
  __zoomLevelStart = 1

  /** Scale reported by the previous touch move */
  __lastScale = 1

  /** Whether the current sequence moves along the x-axis */
  __enableScrollX = false

  /** Whether the current sequence moves along the y-axis */
  __enableScrollY = false

  /** Whether an animation was interrupted by the current touch sequence */
  __interruptedAnimation = false

  /** Receives every published position */
  __callback: ScrollCallback | null

  /** Fired once a zoom animation completed */
  __zoomComplete: (() => void) | null = null

  constructor(callback: ScrollCallback, options?: ScrollerOptions) {
    this.animate = new Animate()
    this.__callback = callback

    this.options = {
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
      scrollingComplete: NOOP,
      penetrationDeceleration: 0.03,
      penetrationAcceleration: 0.08,
    }

    if (options) {
      Object.assign(this.options, options)
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * PUBLIC API
   * ---------------------------------------------------------------------------
   */

  /**
   * Configures the dimensions of the client (outer) and content (inner) elements.
   * Requires the available space for the outer element and the outer size of the inner element.
   * All values which are falsy (null or zero etc.) are ignored and the old value is kept.
   *
   * @param clientWidth Inner width of outer element
   * @param clientHeight Inner height of outer element
   * @param contentWidth Outer width of inner element
   * @param contentHeight Outer height of inner element
   */
  setDimensions(
    clientWidth?: number | null,
    clientHeight?: number | null,
    contentWidth?: number | null,
    contentHeight?: number | null,
  ): void {
    // Only update values which are defined
    if (isDefinedNumber(clientWidth)) {
      this.__clientWidth = clientWidth
    }

    if (isDefinedNumber(clientHeight)) {
      this.__clientHeight = clientHeight
    }

    if (isDefinedNumber(contentWidth)) {
      this.__contentWidth = contentWidth
    }

    if (isDefinedNumber(contentHeight)) {
      this.__contentHeight = contentHeight
    }

    // Refresh maximums
    this.__computeScrollMax()

    // Refresh scroll position
    this.scrollTo(this.__scrollLeft, this.__scrollTop, true)
  }

  /**
   * Sets the client coordinates in relation to the document.
   *
   * @param left Left position of outer element
   * @param top Top position of outer element
   */
  setPosition(left?: number | null, top?: number | null): void {
    this.__clientLeft = left || 0
    this.__clientTop = top || 0
  }

  /**
   * Configures the snapping (when snapping is active)
   *
   * @param width Snapping width
   * @param height Snapping height
   */
  setSnapSize(width: number, height: number): void {
    this.__snapWidth = width
    this.__snapHeight = height
  }

  /**
   * Activates pull-to-refresh.
   * A special zone on the top of the list to start a list refresh whenever
   * the user event is released during visibility of this zone.
   * This was introduced by some apps on iOS like
   * the official Twitter client.
   *
   * @param height Height of pull-to-refresh zone on top of rendered list
   * @param activateCallback Callback to execute on activation.
   *  This is for signalling the user about a refresh is about to happen when he release.
   * @param deactivateCallback Callback to execute on deactivation.
   *  This is for signalling the user about the refresh being cancelled.
   * @param startCallback Callback to execute to start the real async refresh action.
   *  Call {@link finishPullToRefresh} after finish of refresh.
   */
  activatePullToRefresh(
    height: number,
    activateCallback: () => void,
    deactivateCallback: () => void,
    startCallback: () => void,
  ): void {
    this.__refreshHeight = height
    this.__refreshActivate = activateCallback
    this.__refreshDeactivate = deactivateCallback
    this.__refreshStart = startCallback
  }

  /**
   * Starts pull-to-refresh manually.
   */
  triggerPullToRefresh(): void {
    // Use publish instead of scrollTo to allow scrolling to out of boundary position
    // We don't need to normalize scrollLeft, zoomLevel, etc.
    // here because we only y-scrolling when pull-to-refresh is enabled
    this.__publish(
      this.__scrollLeft,
      -(this.__refreshHeight ?? 0),
      this.__zoomLevel,
      true,
    )

    this.__refreshStart?.()
  }

  /**
   * Signalizes that pull-to-refresh is finished.
   */
  finishPullToRefresh(): void {
    this.__refreshActive = false
    this.__refreshDeactivate?.()

    this.scrollTo(this.__scrollLeft, this.__scrollTop, true)
  }

  /**
   * Returns the scroll position and zooming values
   *
   * @return `left` and `top` scroll position and `zoom` level
   */
  getValues(): ScrollerValues {
    return {
      left: this.__scrollLeft,
      top: this.__scrollTop,
      zoom: this.__zoomLevel,
    }
  }

  /**
   * Returns the maximum scroll values
   *
   * @return `left` and `top` maximum scroll values
   */
  getScrollMax(): ScrollMax {
    return {
      left: this.__maxScrollLeft,
      top: this.__maxScrollTop,
    }
  }

  /**
   * Zooms to the given level. Supports optional animation. Zooms
   * the center when no coordinates are given.
   *
   * @param level Level to zoom to
   * @param animate Whether to use animation
   * @param originLeft Zoom in at given left coordinate
   * @param originTop Zoom in at given top coordinate
   * @param callback A callback that gets fired when the zoom is complete.
   */
  zoomTo(
    level: number,
    animate?: boolean,
    originLeft?: number | null,
    originTop?: number | null,
    callback?: (() => void) | null,
  ): void {
    let insideLevel = level
    let insideOriginLeft = originLeft
    let insideOriginTop = originTop

    if (!this.options.zooming) {
      throw new Error('Zooming is not enabled!')
    }

    // Add callback if exists
    if (callback) {
      this.__zoomComplete = callback
    }

    // Stop deceleration
    if (this.__isDecelerating) {
      this.animate.stop(this.__isDecelerating)
      this.__isDecelerating = false
    }

    const oldLevel = this.__zoomLevel

    // Normalize input origin to center of viewport if not defined
    insideOriginLeft ??= this.__clientWidth / 2

    insideOriginTop ??= this.__clientHeight / 2

    // Limit level according to configuration
    insideLevel = Math.max(Math.min(insideLevel, this.options.maxZoom), this.options.minZoom)

    // Recompute maximum values while temporary tweaking maximum scroll ranges
    this.__computeScrollMax(insideLevel)

    // Recompute left and top coordinates based on new zoom level
    let left = ((insideOriginLeft + this.__scrollLeft) * insideLevel) / oldLevel - insideOriginLeft
    let top = ((insideOriginTop + this.__scrollTop) * insideLevel) / oldLevel - insideOriginTop

    // Limit x-axis
    if (left > this.__maxScrollLeft) {
      left = this.__maxScrollLeft
    }
    else if (left < 0) {
      left = 0
    }

    // Limit y-axis
    if (top > this.__maxScrollTop) {
      top = this.__maxScrollTop
    }
    else if (top < 0) {
      top = 0
    }

    // Push values out
    this.__publish(left, top, insideLevel, animate)
  }

  /**
   * Zooms the content by the given factor.
   *
   * @param factor Zoom by given factor
   * @param animate Whether to use animation
   * @param originLeft Zoom in at given left coordinate
   * @param originTop Zoom in at given top coordinate
   * @param callback A callback that gets fired when the zoom is complete.
   */
  zoomBy(
    factor: number,
    animate?: boolean,
    originLeft?: number | null,
    originTop?: number | null,
    callback?: (() => void) | null,
  ): void {
    this.zoomTo(this.__zoomLevel * factor, animate, originLeft, originTop, callback)
  }

  /**
   * Scrolls to the given position. Respect limitations and snapping automatically.
   *
   * @param left Horizontal scroll position
   * @param top Vertical scroll position
   * @param animate Whether the scrolling should happen using an animation
   * @param zoom Zoom level to go to
   */
  scrollTo(left: number, top: number, animate?: boolean, zoom?: number | null): void {
    let insideLeft = left
    let insideTop = top
    let insideAnimate = animate
    let insideZoom = zoom

    // Stop deceleration
    if (this.__isDecelerating) {
      this.animate.stop(this.__isDecelerating)
      this.__isDecelerating = false
    }

    // Correct coordinates based on new zoom level
    if (insideZoom != null && insideZoom !== this.__zoomLevel) {
      if (!this.options.zooming) {
        throw new Error('Zooming is not enabled!')
      }

      insideLeft *= insideZoom
      insideTop *= insideZoom

      // Recompute maximum values while temporary tweaking maximum scroll ranges
      this.__computeScrollMax(insideZoom)
    }
    else {
      // Keep zoom when not defined
      insideZoom = this.__zoomLevel
    }

    if (!this.options.scrollingX) {
      insideLeft = this.__scrollLeft
    }
    else if (this.options.paging) {
      insideLeft = Math.round(insideLeft / this.__clientWidth) * this.__clientWidth
    }
    else if (this.options.snapping) {
      insideLeft = Math.round(insideLeft / this.__snapWidth) * this.__snapWidth
    }

    if (!this.options.scrollingY) {
      insideTop = this.__scrollTop
    }
    else if (this.options.paging) {
      insideTop = Math.round(insideTop / this.__clientHeight) * this.__clientHeight
    }
    else if (this.options.snapping) {
      insideTop = Math.round(insideTop / this.__snapHeight) * this.__snapHeight
    }

    // Limit for allowed ranges
    insideLeft = Math.max(Math.min(this.__maxScrollLeft, insideLeft), 0)
    insideTop = Math.max(Math.min(this.__maxScrollTop, insideTop), 0)

    // Don't animate when no change detected, still call publish to make sure
    // that rendered position is really in-sync with internal data
    if (insideLeft === this.__scrollLeft && insideTop === this.__scrollTop) {
      insideAnimate = false
    }

    // Publish new values
    if (!this.__isTracking) {
      this.__publish(insideLeft, insideTop, insideZoom, insideAnimate)
    }
  }

  /**
   * Scroll by the given offset
   *
   * @param left Scroll x-axis by given offset
   * @param top Scroll y-axis by given offset
   * @param animate Whether to animate the given change
   */
  scrollBy(left?: number | null, top?: number | null, animate?: boolean): void {
    const startLeft = this.__isAnimating ? this.__scheduledLeft : this.__scrollLeft
    const startTop = this.__isAnimating ? this.__scheduledTop : this.__scrollTop

    this.scrollTo(startLeft + (left || 0), startTop + (top || 0), animate)
  }

  /**
   * ---------------------------------------------------------------------------
   * EVENT CALLBACKS
   * ---------------------------------------------------------------------------
   */

  /**
   * Mouse wheel handler for zooming support.
   *
   * The timestamp is part of the event API for symmetry with the touch
   * handlers; zooming is derived from the wheel delta alone, so it is ignored.
   */
  doMouseZoom(wheelDelta: number, _timeStamp: TimeStamp, pageX: number, pageY: number): void {
    const change = wheelDelta > 0
      ? 0.97
      : 1.03

    this.zoomTo(
      this.__zoomLevel * change,
      false,
      pageX - this.__clientLeft,
      pageY - this.__clientTop,
    )
  }

  /**
   * Touch start handler for scrolling support
   */
  doTouchStart(touches: TouchList, timeStamp: TimeStamp): void {
    let insideTimeStamp = timeStamp

    // Array-like check is enough here
    if (touches.length == null) {
      throw new TypeError(`Invalid touch list: ${touches}`)
    }

    if (insideTimeStamp instanceof Date) {
      insideTimeStamp = insideTimeStamp.valueOf()
    }

    if (typeof insideTimeStamp !== 'number') {
      throw new TypeError(`Invalid timestamp value: ${insideTimeStamp}`)
    }

    // Reset interruptedAnimation flag
    this.__interruptedAnimation = true

    // Stop deceleration
    if (this.__isDecelerating) {
      this.animate.stop(this.__isDecelerating)
      this.__isDecelerating = false
      this.__interruptedAnimation = true
    }

    // Stop animation
    if (this.__isAnimating) {
      this.animate.stop(this.__isAnimating)
      this.__isAnimating = false
      this.__interruptedAnimation = true
    }

    // Use center point when dealing with two fingers
    let currentTouchLeft: number
    let currentTouchTop: number
    const isSingleTouch = touches.length === 1
    if (isSingleTouch) {
      currentTouchLeft = touches[0].pageX
      currentTouchTop = touches[0].pageY
    }
    else {
      currentTouchLeft = Math.abs(touches[0].pageX + touches[1].pageX) / 2
      currentTouchTop = Math.abs(touches[0].pageY + touches[1].pageY) / 2
    }

    // Store initial positions
    this.__initialTouchLeft = currentTouchLeft
    this.__initialTouchTop = currentTouchTop

    // Store current zoom level
    this.__zoomLevelStart = this.__zoomLevel

    // Store initial touch positions
    this.__lastTouchLeft = currentTouchLeft
    this.__lastTouchTop = currentTouchTop

    // Store initial move time stamp
    this.__lastTouchMove = insideTimeStamp

    // Reset initial scale
    this.__lastScale = 1

    // Reset locking flags
    this.__enableScrollX = !isSingleTouch && this.options.scrollingX
    this.__enableScrollY = !isSingleTouch && this.options.scrollingY

    // Reset tracking flag
    this.__isTracking = true

    // Reset deceleration complete flag
    this.__didDecelerationComplete = false

    // Dragging starts directly with two fingers, otherwise lazy with an offset
    this.__isDragging = !isSingleTouch

    // Some features are disabled in multi touch scenarios
    this.__isSingleTouch = isSingleTouch

    // Clearing data structure
    this.__positions = []
  }

  /**
   * Touch move handler for scrolling support
   */
  doTouchMove(touches: TouchList, timeStamp: TimeStamp, scale?: number): void {
    let insideTimeStamp = timeStamp

    // Array-like check is enough here
    if (touches.length == null) {
      throw new TypeError(`Invalid touch list: ${touches}`)
    }

    if (insideTimeStamp instanceof Date) {
      insideTimeStamp = insideTimeStamp.valueOf()
    }

    if (typeof insideTimeStamp !== 'number') {
      throw new TypeError(`Invalid timestamp value: ${insideTimeStamp}`)
    }

    // Ignore event when tracking is not enabled (event might be outside of element)
    if (!this.__isTracking) {
      return
    }

    let currentTouchLeft: number
    let currentTouchTop: number

    // Compute move based around of center of fingers
    if (touches.length === 2) {
      currentTouchLeft = Math.abs(touches[0].pageX + touches[1].pageX) / 2
      currentTouchTop = Math.abs(touches[0].pageY + touches[1].pageY) / 2
    }
    else {
      currentTouchLeft = touches[0].pageX
      currentTouchTop = touches[0].pageY
    }

    const positions = this.__positions

    // Are we already is dragging mode?
    if (this.__isDragging) {
      // Compute move distance
      const moveX = currentTouchLeft - this.__lastTouchLeft
      const moveY = currentTouchTop - this.__lastTouchTop

      // Read previous scroll position and zooming
      let scrollLeft = this.__scrollLeft
      let scrollTop = this.__scrollTop
      let level = this.__zoomLevel

      // Work with scaling
      if (scale != null && this.options.zooming) {
        const oldLevel = level

        // Recompute level based on previous scale and new scale
        level = (level / this.__lastScale) * scale

        // Limit level according to configuration
        level = Math.max(Math.min(level, this.options.maxZoom), this.options.minZoom)

        // Only do further compution when change happened
        if (oldLevel !== level) {
          // Compute relative event position to container
          const currentTouchLeftRel = currentTouchLeft - this.__clientLeft
          const currentTouchTopRel = currentTouchTop - this.__clientTop

          // Recompute left and top coordinates based on new zoom level
          scrollLeft = ((currentTouchLeftRel + scrollLeft) * level) / oldLevel
            - currentTouchLeftRel
          scrollTop = ((currentTouchTopRel + scrollTop) * level) / oldLevel - currentTouchTopRel

          // Recompute max scroll values
          this.__computeScrollMax(level)
        }
      }

      if (this.__enableScrollX) {
        scrollLeft -= moveX * this.options.speedMultiplier
        const maxScrollLeft = this.__maxScrollLeft

        if (scrollLeft > maxScrollLeft || scrollLeft < 0) {
          // Slow down on the edges
          if (this.options.bouncing) {
            scrollLeft += (moveX / 2) * this.options.speedMultiplier
          }
          else if (scrollLeft > maxScrollLeft) {
            scrollLeft = maxScrollLeft
          }
          else {
            scrollLeft = 0
          }
        }
      }

      // Compute new vertical scroll position
      if (this.__enableScrollY) {
        scrollTop -= moveY * this.options.speedMultiplier
        const maxScrollTop = this.__maxScrollTop
        const refreshHeight = this.__refreshHeight

        if (scrollTop > maxScrollTop || scrollTop < 0) {
          // Slow down on the edges
          if (this.options.bouncing) {
            scrollTop += (moveY / 2) * this.options.speedMultiplier

            // Support pull-to-refresh (only when only y is scrollable)
            if (!this.__enableScrollX && refreshHeight != null) {
              if (!this.__refreshActive && scrollTop <= -refreshHeight) {
                this.__refreshActive = true
                this.__refreshActivate?.()
              }
              else if (this.__refreshActive && scrollTop > -refreshHeight) {
                this.__refreshActive = false
                this.__refreshDeactivate?.()
              }
            }
          }
          else if (scrollTop > maxScrollTop) {
            scrollTop = maxScrollTop
          }
          else {
            scrollTop = 0
          }
        }
      }

      // Keep list from growing infinitely (holding min 10, max 20 measure points)
      if (positions.length > 60) {
        positions.splice(0, 30)
      }

      // Track scroll movement for decleration
      positions.push(scrollLeft, scrollTop, insideTimeStamp)

      // Sync scroll position
      this.__publish(scrollLeft, scrollTop, level)

      // Otherwise figure out whether we are switching into dragging mode now.
    }
    else {
      const minimumTrackingForScroll = this.options.locking ? 3 : 0
      const minimumTrackingForDrag = 5

      const distanceX = Math.abs(currentTouchLeft - this.__initialTouchLeft)
      const distanceY = Math.abs(currentTouchTop - this.__initialTouchTop)

      this.__enableScrollX = this.options.scrollingX && distanceX >= minimumTrackingForScroll
      this.__enableScrollY = this.options.scrollingY && distanceY >= minimumTrackingForScroll

      positions.push(this.__scrollLeft, this.__scrollTop, insideTimeStamp)

      this.__isDragging = (this.__enableScrollX || this.__enableScrollY)
        && (distanceX >= minimumTrackingForDrag || distanceY >= minimumTrackingForDrag)

      if (this.__isDragging) {
        this.__interruptedAnimation = false
      }
    }

    // Update last touch positions and time stamp for next event
    this.__lastTouchLeft = currentTouchLeft
    this.__lastTouchTop = currentTouchTop
    this.__lastTouchMove = insideTimeStamp
    // A move without a scale (mouse input) keeps the ratio of the previous
    // pinch instead of resetting it, so the next pinch does not jump.
    this.__lastScale = scale ?? this.__lastScale
  }

  /**
   * Touch end handler for scrolling support
   */
  doTouchEnd(timeStamp: TimeStamp): void {
    let insideTimeStamp = timeStamp

    if (insideTimeStamp instanceof Date) {
      insideTimeStamp = insideTimeStamp.valueOf()
    }

    if (typeof insideTimeStamp !== 'number') {
      throw new TypeError(`Invalid timestamp value: ${insideTimeStamp}`)
    }

    // Ignore event when tracking is not enabled (no touchstart event on element)
    // This is required as this listener ('touchmove') sits on the document
    // and not on the element itself.
    if (!this.__isTracking) {
      return
    }

    // Not touching anymore (when two finger hit the screen there are two touch end events)
    this.__isTracking = false

    // Be sure to reset the dragging flag now. Here we also detect whether
    // the finger has moved fast enough to switch into a deceleration animation.
    if (this.__isDragging) {
      // Reset dragging flag
      this.__isDragging = false

      // Start deceleration
      // Verify that the last move detected was in some relevant time frame
      if (
        this.__isSingleTouch
        && this.options.animating
        && insideTimeStamp - this.__lastTouchMove <= 100
      ) {
        // Then figure out what the scroll position was about 100ms ago
        const endPos = this.__positions.length - 1
        let startPos = endPos

        // Move pointer to position measured 100ms ago
        for (let i = endPos; i > 0 && this.__positions[i] > this.__lastTouchMove - 100; i -= 3) {
          startPos = i
        }

        // If start and stop position is identical in a 100ms timeframe,
        // we cannot compute any useful deceleration.
        if (startPos !== endPos) {
          // Compute relative movement between these two points
          const timeOffset = this.__positions[endPos] - this.__positions[startPos]
          const movedLeft = this.__scrollLeft - this.__positions[startPos - 2]
          const movedTop = this.__scrollTop - this.__positions[startPos - 1]

          // Based on 50ms compute the movement to apply for each render step
          this.__decelerationVelocityX = (movedLeft / timeOffset) * (1000 / 60)
          this.__decelerationVelocityY = (movedTop / timeOffset) * (1000 / 60)

          // How much velocity is required to start the deceleration
          const minVelocityToStartDeceleration = this.options.paging
            || this.options.snapping
            ? 4
            : 1

          // Verify that we have enough velocity to start deceleration
          if (
            Math.abs(this.__decelerationVelocityX) > minVelocityToStartDeceleration
            || Math.abs(this.__decelerationVelocityY) > minVelocityToStartDeceleration
          ) {
            // Deactivate pull-to-refresh when decelerating
            if (!this.__refreshActive) {
              this.__startDeceleration()
            }
          }
          else {
            this.options.scrollingComplete()
          }
        }
        else {
          this.options.scrollingComplete()
        }
      }
      else if (insideTimeStamp - this.__lastTouchMove > 100) {
        this.options.scrollingComplete()
      }
    }

    // If this was a slower move it is per default non decelerated, but this
    // still means that we want snap back to the bounds which is done here.
    // This is placed outside the condition above to improve edge case stability
    // e.g. touchend fired without enabled dragging. This should normally do not
    // have modified the scroll positions or even showed the scrollbars though.
    if (!this.__isDecelerating) {
      if (this.__refreshActive && this.__refreshStart) {
        // Use publish instead of scrollTo to allow scrolling to out of boundary position
        // We don't need to normalize scrollLeft, zoomLevel, etc.
        // here because we only y-scrolling when pull-to-refresh is enabled
        this.__publish(
          this.__scrollLeft,
          -(this.__refreshHeight ?? 0),
          this.__zoomLevel,
          true,
        )

        this.__refreshStart()
      }
      else {
        if (this.__interruptedAnimation || this.__isDragging) {
          this.options.scrollingComplete()
        }

        this.scrollTo(this.__scrollLeft, this.__scrollTop, true, this.__zoomLevel)

        // Directly signalize deactivation (nothing todo on refresh?)
        if (this.__refreshActive) {
          this.__refreshActive = false
          this.__refreshDeactivate?.()
        }
      }
    }

    // Fully cleanup list
    this.__positions.length = 0
  }

  /**
   * ---------------------------------------------------------------------------
   * PRIVATE API
   * ---------------------------------------------------------------------------
   */

  /**
   * Applies the scroll position to the content element
   *
   * @param left Left scroll position
   * @param top Top scroll position
   * @param zoom Zoom level
   * @param animate Whether animation should be used to move to the new coordinates
   */
  __publish(left: number, top: number, zoom: number, animate?: boolean): void {
    // Remember whether we had an animation,
    // then we try to continue based on the current "drive" of the animation
    const wasAnimating = this.__isAnimating
    if (wasAnimating) {
      this.animate.stop(wasAnimating)
      this.__isAnimating = false
    }

    if (animate && this.options.animating) {
      // Keep scheduled positions for scrollBy/zoomBy functionality
      this.__scheduledLeft = left
      this.__scheduledTop = top
      this.__scheduledZoom = zoom

      const oldLeft = this.__scrollLeft
      const oldTop = this.__scrollTop
      const oldZoom = this.__zoomLevel

      const diffLeft = left - oldLeft
      const diffTop = top - oldTop
      const diffZoom = zoom - oldZoom

      const step = (percent: number, _now: number, render: boolean): void => {
        if (render) {
          this.__scrollLeft = oldLeft + diffLeft * percent
          this.__scrollTop = oldTop + diffTop * percent
          this.__zoomLevel = oldZoom + diffZoom * percent

          // Push values out
          this.__callback?.(this.__scrollLeft, this.__scrollTop, this.__zoomLevel)
        }
      }

      const verify = (id: number): boolean => this.__isAnimating === id

      const completed = (_renderedFramesPerSecond: number, animationId: number, wasFinished: boolean): void => {
        if (animationId === this.__isAnimating) {
          this.__isAnimating = false
        }

        if (this.__didDecelerationComplete || wasFinished) {
          this.options.scrollingComplete()
        }

        if (this.options.zooming) {
          this.__computeScrollMax()
          if (this.__zoomComplete) {
            this.__zoomComplete()
            this.__zoomComplete = null
          }
        }
      }

      // When continuing based on previous animation we choose an ease-out animation
      // instead of ease-in-out
      this.__isAnimating = this.animate.start(
        step,
        verify,
        completed,
        this.options.animationDuration,
        wasAnimating ? easeOutCubic : easeInOutCubic,
      )
    }
    else {
      this.__scheduledLeft = left
      this.__scrollLeft = left
      this.__scheduledTop = top
      this.__scrollTop = top
      this.__scheduledZoom = zoom
      this.__zoomLevel = zoom

      // Push values out
      this.__callback?.(left, top, zoom)

      // Fix max scroll ranges
      if (this.options.zooming) {
        this.__computeScrollMax()
        if (this.__zoomComplete) {
          this.__zoomComplete()
          this.__zoomComplete = null
        }
      }
    }
  }

  /**
   * Recomputes scroll minimum values based on client dimensions and content dimensions.
   */
  __computeScrollMax(zoomLevel?: number): void {
    const insideZoomLevel = zoomLevel ?? this.__zoomLevel

    this.__maxScrollLeft = Math.max(this.__contentWidth * insideZoomLevel - this.__clientWidth, 0)
    this.__maxScrollTop = Math.max(this.__contentHeight * insideZoomLevel - this.__clientHeight, 0)
  }

  /**
   * ---------------------------------------------------------------------------
   * ANIMATION (DECELERATION) SUPPORT
   * ---------------------------------------------------------------------------
   */

  /**
   * Called when a touch sequence end and the speed of the finger was high enough
   * to switch into deceleration mode.
   */
  __startDeceleration(): void {
    if (this.options.paging) {
      const scrollLeft = Math.max(Math.min(this.__scrollLeft, this.__maxScrollLeft), 0)
      const scrollTop = Math.max(Math.min(this.__scrollTop, this.__maxScrollTop), 0)
      const clientWidth = this.__clientWidth
      const clientHeight = this.__clientHeight

      // We limit deceleration not to the min/max values of the allowed range,
      // but to the size of the visible client area.
      // Each page should have exactly the size of the client area.
      this.__minDecelerationScrollLeft = Math.floor(scrollLeft / clientWidth) * clientWidth
      this.__minDecelerationScrollTop = Math.floor(scrollTop / clientHeight) * clientHeight
      this.__maxDecelerationScrollLeft = Math.ceil(scrollLeft / clientWidth) * clientWidth
      this.__maxDecelerationScrollTop = Math.ceil(scrollTop / clientHeight) * clientHeight
    }
    else {
      this.__minDecelerationScrollLeft = 0
      this.__minDecelerationScrollTop = 0
      this.__maxDecelerationScrollLeft = this.__maxScrollLeft
      this.__maxDecelerationScrollTop = this.__maxScrollTop
    }

    // Wrap class method
    const step = (_percent: number, _now: number, render: boolean): void =>
      this.__stepThroughDeceleration(render)

    // How much velocity is required to keep the deceleration running
    const minVelocityToKeepDecelerating = this.options.snapping ? 4 : 0.001

    // Detect whether it's still worth to continue animating steps
    // If we are already slow enough to not being user perceivable anymore,
    // we stop the whole process here.
    const verify = (): boolean => {
      const shouldContinue = Math.abs(this.__decelerationVelocityX) >= minVelocityToKeepDecelerating
        || Math.abs(this.__decelerationVelocityY) >= minVelocityToKeepDecelerating

      if (!shouldContinue) {
        this.__didDecelerationComplete = true
      }

      return shouldContinue
    }

    const completed = (): void => {
      this.__isDecelerating = false

      if (this.__didDecelerationComplete) {
        this.options.scrollingComplete()
      }

      // Animate to grid when snapping is active, otherwise just fix out-of-boundary positions
      this.scrollTo(this.__scrollLeft, this.__scrollTop, this.options.snapping)
    }

    // Start animation and switch on flag
    this.__isDecelerating = this.animate.start(step, verify, completed)
  }

  /**
   * Called on every step of the animation
   *
   * @param render Whether the step should be rendered
   */
  __stepThroughDeceleration(render: boolean): void {
    //
    // COMPUTE NEXT SCROLL POSITION
    //

    // Add deceleration to scroll position
    let scrollLeft = this.__scrollLeft + this.__decelerationVelocityX
    let scrollTop = this.__scrollTop + this.__decelerationVelocityY

    //
    // HARD LIMIT SCROLL POSITION FOR NON BOUNCING MODE
    //

    if (!this.options.bouncing) {
      const scrollLeftFixed = Math.max(
        Math.min(this.__maxDecelerationScrollLeft, scrollLeft),
        this.__minDecelerationScrollLeft,
      )
      if (scrollLeftFixed !== scrollLeft) {
        scrollLeft = scrollLeftFixed
        this.__decelerationVelocityX = 0
      }

      const scrollTopFixed = Math.max(
        Math.min(this.__maxDecelerationScrollTop, scrollTop),
        this.__minDecelerationScrollTop,
      )
      if (scrollTopFixed !== scrollTop) {
        scrollTop = scrollTopFixed
        this.__decelerationVelocityY = 0
      }
    }

    //
    // UPDATE SCROLL POSITION
    //

    if (render) {
      this.__publish(scrollLeft, scrollTop, this.__zoomLevel)
    }
    else {
      this.__scrollLeft = scrollLeft
      this.__scrollTop = scrollTop
    }

    //
    // SLOW DOWN
    //

    // Slow down velocity on every iteration
    if (!this.options.paging) {
      // This is the factor applied to every iteration of the animation
      // to slow down the process. This should emulate natural behavior where
      // objects slow down when the initiator of the movement is removed
      const frictionFactor = 0.95

      this.__decelerationVelocityX *= frictionFactor
      this.__decelerationVelocityY *= frictionFactor
    }

    //
    // BOUNCING SUPPORT
    //

    if (this.options.bouncing) {
      let scrollOutsideX = 0
      let scrollOutsideY = 0

      // This configures the amount of change applied to deceleration/acceleration
      // when reaching boundaries
      const { penetrationDeceleration, penetrationAcceleration } = this.options

      // Check limits
      if (scrollLeft < this.__minDecelerationScrollLeft) {
        scrollOutsideX = this.__minDecelerationScrollLeft - scrollLeft
      }
      else if (scrollLeft > this.__maxDecelerationScrollLeft) {
        scrollOutsideX = this.__maxDecelerationScrollLeft - scrollLeft
      }

      if (scrollTop < this.__minDecelerationScrollTop) {
        scrollOutsideY = this.__minDecelerationScrollTop - scrollTop
      }
      else if (scrollTop > this.__maxDecelerationScrollTop) {
        scrollOutsideY = this.__maxDecelerationScrollTop - scrollTop
      }

      // Slow down until slow enough, then flip back to snap position
      if (scrollOutsideX !== 0) {
        if (scrollOutsideX * this.__decelerationVelocityX <= 0) {
          this.__decelerationVelocityX += scrollOutsideX * penetrationDeceleration
        }
        else {
          this.__decelerationVelocityX = scrollOutsideX * penetrationAcceleration
        }
      }

      if (scrollOutsideY !== 0) {
        if (scrollOutsideY * this.__decelerationVelocityY <= 0) {
          this.__decelerationVelocityY += scrollOutsideY * penetrationDeceleration
        }
        else {
          this.__decelerationVelocityY = scrollOutsideY * penetrationAcceleration
        }
      }
    }
  }
}
