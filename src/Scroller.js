/**
 * Scroller
 * http://github.com/cycjimmy/scroller
 *
 * Based on zynga/scroller
 * http://github.com/zynga/scroller
 * Copyright 2011, Zynga Inc.
 * Licensed under the MIT License.
 */

import entries from '@cycjimmy/awesome-js-funcs/esm/object/entries';
import Animate from './Animate';
import { easeOutCubic, easeInOutCubic } from './easing';

const NOOP = () => {};

/**
 * A pure logic 'component' for 'virtual' scrolling/zooming.
 */
export default class {
  constructor(callback, options) {
    this.animate = new Animate();
    this.__callback = callback;

    this.options = {
      /** Enable scrolling on x-axis */
      scrollingX: true,

      /** Enable scrolling on y-axis */
      scrollingY: true,

      /** Enable animations for deceleration, snap back, zooming and scrolling */
      animating: true,

      /** duration for animations triggered by scrollTo/zoomTo */
      animationDuration: 250,

      /** Enable bouncing (content can be slowly moved outside and jumps back after releasing) */
      bouncing: true,

      /** Enable locking to the main axis if user moves only slightly on one of them at start */
      locking: true,

      /** Enable pagination mode (switching between full page content panes) */
      paging: false,

      /** Enable snapping of content to a configured pixel grid */
      snapping: false,

      /** Enable zooming of content via API, fingers and mouse wheel */
      zooming: false,

      /** Minimum zoom level */
      minZoom: 0.5,

      /** Maximum zoom level */
      maxZoom: 3,

      /** Multiply or decrease scrolling speed * */
      speedMultiplier: 1,

      /** Callback that is fired on the later of touch end or deceleration end,
       provided that another scrolling action has not begun. Used to know
       when to fade out a scrollbar. */
      scrollingComplete: NOOP,

      /** This configures the amount of change applied to deceleration
       when reaching boundaries */
      penetrationDeceleration: 0.03,

      /** This configures the amount of change applied to acceleration
       when reaching boundaries */
      penetrationAcceleration: 0.08,
    };

    entries(options).forEach(([key, value]) => {
      this.options[key] = value;
    });

    /**
     ---------------------------------------------------------------------------
     INTERNAL FIELDS :: STATUS
     ---------------------------------------------------------------------------
     */
    /** {Boolean} Whether only a single finger is used in touch handling */
    this.__isSingleTouch = false;

    /** {Boolean} Whether a touch event sequence is in progress */
    this.__isTracking = false;

    /** {Boolean} Whether a deceleration animation went to completion. */
    this.__didDecelerationComplete = false;

    /**
     * {Boolean} Whether a gesture zoom/rotate event is in progress. Activates when
     * a gesturestart event happens. This has higher priority than dragging.
     */
    this.__isGesturing = false;

    /**
     * {Boolean} Whether the user has moved by such a distance that we have enabled
     * dragging mode. Hint: It's only enabled after some pixels of movement to
     * not interrupt with clicks etc.
     */
    this.__isDragging = false;

    /**
     * {Boolean} Not touching and dragging anymore, and smoothly animating the
     * touch sequence using deceleration.
     */
    this.__isDecelerating = false;

    /**
     * {Boolean} Smoothly animating the currently configured change
     */
    this.__isAnimating = false;

    /**
     ---------------------------------------------------------------------------
     INTERNAL FIELDS :: DIMENSIONS
     ---------------------------------------------------------------------------
     */
    /** {Integer} Available outer left position (from document perspective) */
    this.__clientLeft = 0;

    /** {Integer} Available outer top position (from document perspective) */
    this.__clientTop = 0;

    /** {Integer} Available outer width */
    this.__clientWidth = 0;

    /** {Integer} Available outer height */
    this.__clientHeight = 0;

    /** {Integer} Outer width of content */
    this.__contentWidth = 0;

    /** {Integer} Outer height of content */
    this.__contentHeight = 0;

    /** {Integer} Snapping width for content */
    this.__snapWidth = 100;

    /** {Integer} Snapping height for content */
    this.__snapHeight = 100;

    /** {Integer} Height to assign to refresh area */
    this.__refreshHeight = null;

    /** {Boolean} Whether the refresh process is enabled when the event is released now */
    this.__refreshActive = false;

    /** {Function} Callback to execute on activation.
     This is for signalling the user about a refresh is about to happen when he release */
    this.__refreshActivate = null;

    /** {Function} Callback to execute on deactivation.
     This is for signalling the user about the refresh being cancelled */
    this.__refreshDeactivate = null;

    /** {Function} Callback to execute to start the actual refresh.
     Call {@link #refreshFinish} when done */
    this.__refreshStart = null;

    /** {Number} Zoom level */
    this.__zoomLevel = 1;

    /** {Number} Scroll position on x-axis */
    this.__scrollLeft = 0;

    /** {Number} Scroll position on y-axis */
    this.__scrollTop = 0;

    /** {Integer} Maximum allowed scroll position on x-axis */
    this.__maxScrollLeft = 0;

    /** {Integer} Maximum allowed scroll position on y-axis */
    this.__maxScrollTop = 0;

    /** {Number} Scheduled left position (final position when animating) */
    this.__scheduledLeft = 0;

    /** {Number} Scheduled top position (final position when animating) */
    this.__scheduledTop = 0;

    /** {Number} Scheduled zoom level (final scale when animating) */
    this.__scheduledZoom = 0;

    /**
     ---------------------------------------------------------------------------
     INTERNAL FIELDS :: LAST POSITIONS
     ---------------------------------------------------------------------------
     */
    /** {Number} Left position of finger at start */
    this.__lastTouchLeft = null;

    /** {Number} Top position of finger at start */
    this.__lastTouchTop = null;

    /** {Date} Timestamp of last move of finger.
     Used to limit tracking range for deceleration speed. */
    this.__lastTouchMove = null;

    /** {Array} List of positions, uses three indexes for each state: left, top, timestamp */
    this.__positions = [];

    /**
     ---------------------------------------------------------------------------
     INTERNAL FIELDS :: DECELERATION SUPPORT
     ---------------------------------------------------------------------------
     */
    /** {Integer} Minimum left scroll position during deceleration */
    this.__minDecelerationScrollLeft = null;

    /** {Integer} Minimum top scroll position during deceleration */
    this.__minDecelerationScrollTop = null;

    /** {Integer} Maximum left scroll position during deceleration */
    this.__maxDecelerationScrollLeft = null;

    /** {Integer} Maximum top scroll position during deceleration */
    this.__maxDecelerationScrollTop = null;

    /** {Number} Current factor to modify horizontal scroll position with on every step */
    this.__decelerationVelocityX = null;

    /** {Number} Current factor to modify vertical scroll position with on every step */
    this.__decelerationVelocityY = null;
  }

  /**
   ---------------------------------------------------------------------------
   PUBLIC API
   ---------------------------------------------------------------------------
   */

  /**
   * Configures the dimensions of the client (outer) and content (inner) elements.
   * Requires the available space for the outer element and the outer size of the inner element.
   * All values which are falsy (null or zero etc.) are ignored and the old value is kept.
   *
   * @param clientWidth {Integer ? null} Inner width of outer element
   * @param clientHeight {Integer ? null} Inner height of outer element
   * @param contentWidth {Integer ? null} Outer width of inner element
   * @param contentHeight {Integer ? null} Outer height of inner element
   */
  setDimensions(clientWidth, clientHeight, contentWidth, contentHeight) {
    // Only update values which are defined
    if (clientWidth === +clientWidth) {
      this.__clientWidth = clientWidth;
    }

    if (clientHeight === +clientHeight) {
      this.__clientHeight = clientHeight;
    }

    if (contentWidth === +contentWidth) {
      this.__contentWidth = contentWidth;
    }

    if (contentHeight === +contentHeight) {
      this.__contentHeight = contentHeight;
    }

    // Refresh maximums
    this.__computeScrollMax();

    // Refresh scroll position
    this.scrollTo(this.__scrollLeft, this.__scrollTop, true);
  }

  /**
   * Sets the client coordinates in relation to the document.
   *
   * @param left {Integer ? 0} Left position of outer element
   * @param top {Integer ? 0} Top position of outer element
   */
  setPosition(left, top) {
    this.__clientLeft = left || 0;
    this.__clientTop = top || 0;
  }

  /**
   * Configures the snapping (when snapping is active)
   *
   * @param width {Integer} Snapping width
   * @param height {Integer} Snapping height
   */
  setSnapSize(width, height) {
    this.__snapWidth = width;
    this.__snapHeight = height;
  }

  /**
   * Activates pull-to-refresh.
   * A special zone on the top of the list to start a list refresh whenever
   * the user event is released during visibility of this zone.
   * This was introduced by some apps on iOS like
   * the official Twitter client.
   *
   * @param height {Integer} Height of pull-to-refresh zone on top of rendered list
   * @param activateCallback {Function} Callback to execute on activation.
   *  This is for signalling the user about a refresh is about to happen when he release.
   * @param deactivateCallback {Function} Callback to execute on deactivation.
   *  This is for signalling the user about the refresh being cancelled.
   * @param startCallback {Function} Callback to execute to start the real async refresh action.
   *  Call {@link #finishPullToRefresh} after finish of refresh.
   */
  activatePullToRefresh(height, activateCallback, deactivateCallback, startCallback) {
    this.__refreshHeight = height;
    this.__refreshActivate = activateCallback;
    this.__refreshDeactivate = deactivateCallback;
    this.__refreshStart = startCallback;
  }

  /**
   * Starts pull-to-refresh manually.
   */
  triggerPullToRefresh() {
    // Use publish instead of scrollTo to allow scrolling to out of boundary position
    // We don't need to normalize scrollLeft, zoomLevel, etc.
    // here because we only y-scrolling when pull-to-refresh is enabled
    this.__publish(this.__scrollLeft, -this.__refreshHeight, this.__zoomLevel, true);

    if (this.__refreshStart) {
      this.__refreshStart();
    }
  }

  /**
   * Signalizes that pull-to-refresh is finished.
   */
  finishPullToRefresh() {
    this.__refreshActive = false;
    if (this.__refreshDeactivate) {
      this.__refreshDeactivate();
    }

    this.scrollTo(this.__scrollLeft, this.__scrollTop, true);
  }

  /**
   * Returns the scroll position and zooming values
   *
   * @return {{top: number, left: number, zoom: number}}
   *  `left` and `top` scroll position and `zoom` level
   */
  getValues() {
    return {
      left: this.__scrollLeft,
      top: this.__scrollTop,
      zoom: this.__zoomLevel,
    };
  }

  /**
   * Returns the maximum scroll values
   *
   * @return {{top: number, left: number}} `left` and `top` maximum scroll values
   */
  getScrollMax() {
    return {
      left: this.__maxScrollLeft,
      top: this.__maxScrollTop,
    };
  }

  /**
   * Zooms to the given level. Supports optional animation. Zooms
   * the center when no coordinates are given.
   *
   * @param level {Number} Level to zoom to
   * @param animate {Boolean ? false} Whether to use animation
   * @param originLeft {Number ? null} Zoom in at given left coordinate
   * @param originTop {Number ? null} Zoom in at given top coordinate
   * @param callback {Function ? null} A callback that gets fired when the zoom is complete.
   */
  zoomTo(level, animate, originLeft, originTop, callback) {
    let insideLevel = level;
    let insideOriginLeft = originLeft;
    let _originTop = originTop;

    if (!this.options.zooming) {
      throw new Error('Zooming is not enabled!');
    }

    // Add callback if exists
    if (callback) {
      this.__zoomComplete = callback;
    }

    // Stop deceleration
    if (this.__isDecelerating) {
      this.animate.stop(this.__isDecelerating);
      this.__isDecelerating = false;
    }

    const oldLevel = this.__zoomLevel;

    // Normalize input origin to center of viewport if not defined
    if (insideOriginLeft == null) {
      insideOriginLeft = this.__clientWidth / 2;
    }

    if (_originTop == null) {
      _originTop = this.__clientHeight / 2;
    }

    // Limit level according to configuration
    insideLevel = Math.max(Math.min(insideLevel, this.options.maxZoom), this.options.minZoom);

    // Recompute maximum values while temporary tweaking maximum scroll ranges
    this.__computeScrollMax(insideLevel);

    // Recompute left and top coordinates based on new zoom level
    let left = ((insideOriginLeft + this.__scrollLeft) * insideLevel) / oldLevel - insideOriginLeft;
    let top = ((_originTop + this.__scrollTop) * insideLevel) / oldLevel - _originTop;

    // Limit x-axis
    if (left > this.__maxScrollLeft) {
      left = this.__maxScrollLeft;
    } else if (left < 0) {
      left = 0;
    }

    // Limit y-axis
    if (top > this.__maxScrollTop) {
      top = this.__maxScrollTop;
    } else if (top < 0) {
      top = 0;
    }

    // Push values out
    this.__publish(left, top, insideLevel, animate);
  }

  /**
   * Zooms the content by the given factor.
   *
   * @param factor {Number} Zoom by given factor
   * @param animate {Boolean ? false} Whether to use animation
   * @param originLeft {Number ? 0} Zoom in at given left coordinate
   * @param originTop {Number ? 0} Zoom in at given top coordinate
   * @param callback {Function ? null} A callback that gets fired when the zoom is complete.
   */
  zoomBy(factor, animate, originLeft, originTop, callback) {
    this.zoomTo(this.__zoomLevel * factor, animate, originLeft, originTop, callback);
  }

  /**
   * Scrolls to the given position. Respect limitations and snapping automatically.
   *
   * @param left {Number?null} Horizontal scroll position,
   *  keeps current if value is <code>null</code>
   * @param top {Number?null} Vertical scroll position, keeps current if value is <code>null</code>
   * @param animate {Boolean?false} Whether the scrolling should happen using an animation
   * @param zoom {Number?null} Zoom level to go to
   */
  scrollTo(left, top, animate, zoom) {
    let insideLeft = left;
    let insideTop = top;
    let insideAnimate = animate;
    let insideZoom = zoom;
    // Stop deceleration
    if (this.__isDecelerating) {
      this.animate.stop(this.__isDecelerating);
      this.__isDecelerating = false;
    }

    // Correct coordinates based on new zoom level
    if (insideZoom != null && insideZoom !== this.__zoomLevel) {
      if (!this.options.zooming) {
        throw new Error('Zooming is not enabled!');
      }

      insideLeft *= insideZoom;
      insideTop *= insideZoom;

      // Recompute maximum values while temporary tweaking maximum scroll ranges
      this.__computeScrollMax(insideZoom);
    } else {
      // Keep zoom when not defined
      insideZoom = this.__zoomLevel;
    }

    if (!this.options.scrollingX) {
      insideLeft = this.__scrollLeft;
    } else if (this.options.paging) {
      insideLeft = Math.round(insideLeft / this.__clientWidth) * this.__clientWidth;
    } else if (this.options.snapping) {
      insideLeft = Math.round(insideLeft / this.__snapWidth) * this.__snapWidth;
    }

    if (!this.options.scrollingY) {
      insideTop = this.__scrollTop;
    } else if (this.options.paging) {
      insideTop = Math.round(insideTop / this.__clientHeight) * this.__clientHeight;
    } else if (this.options.snapping) {
      insideTop = Math.round(insideTop / this.__snapHeight) * this.__snapHeight;
    }

    // Limit for allowed ranges
    insideLeft = Math.max(Math.min(this.__maxScrollLeft, insideLeft), 0);
    insideTop = Math.max(Math.min(this.__maxScrollTop, insideTop), 0);

    // Don't animate when no change detected, still call publish to make sure
    // that rendered position is really in-sync with internal data
    if (insideLeft === this.__scrollLeft && insideTop === this.__scrollTop) {
      insideAnimate = false;
    }

    // Publish new values
    if (!this.__isTracking) {
      this.__publish(insideLeft, insideTop, insideZoom, insideAnimate);
    }
  }

  /**
   * Scroll by the given offset
   *
   * @param left {Number ? 0} Scroll x-axis by given offset
   * @param top {Number ? 0} Scroll x-axis by given offset
   * @param animate {Boolean ? false} Whether to animate the given change
   */
  scrollBy(left, top, animate) {
    const startLeft = this.__isAnimating ? this.__scheduledLeft : this.__scrollLeft;
    const startTop = this.__isAnimating ? this.__scheduledTop : this.__scrollTop;

    this.scrollTo(startLeft + (left || 0), startTop + (top || 0), animate);
  }

  /**
   ---------------------------------------------------------------------------
   EVENT CALLBACKS
   ---------------------------------------------------------------------------
   */

  /**
   * Mouse wheel handler for zooming support
   */
  doMouseZoom(wheelDelta, timeStamp, pageX, pageY) {
    const change = wheelDelta > 0 ? 0.97 : 1.03;

    return this.zoomTo(
      this.__zoomLevel * change,
      false,
      pageX - this.__clientLeft,
      pageY - this.__clientTop,
    );
  }

  /**
   * Touch start handler for scrolling support
   */
  doTouchStart(touches, timeStamp) {
    let insideTimeStamp = timeStamp;

    // Array-like check is enough here
    if (touches.length == null) {
      throw new Error(`Invalid touch list: ${touches}`);
    }

    if (insideTimeStamp instanceof Date) {
      insideTimeStamp = insideTimeStamp.valueOf();
    }
    if (typeof insideTimeStamp !== 'number') {
      throw new Error(`Invalid timestamp value: ${insideTimeStamp}`);
    }

    // Reset interruptedAnimation flag
    this.__interruptedAnimation = true;

    // Stop deceleration
    if (this.__isDecelerating) {
      this.animate.stop(this.__isDecelerating);
      this.__isDecelerating = false;
      this.__interruptedAnimation = true;
    }

    // Stop animation
    if (this.__isAnimating) {
      this.animate.stop(this.__isAnimating);
      this.__isAnimating = false;
      this.__interruptedAnimation = true;
    }

    // Use center point when dealing with two fingers
    let currentTouchLeft;
    let currentTouchTop;
    const isSingleTouch = touches.length === 1;
    if (isSingleTouch) {
      currentTouchLeft = touches[0].pageX;
      currentTouchTop = touches[0].pageY;
    } else {
      currentTouchLeft = Math.abs(touches[0].pageX + touches[1].pageX) / 2;
      currentTouchTop = Math.abs(touches[0].pageY + touches[1].pageY) / 2;
    }

    // Store initial positions
    this.__initialTouchLeft = currentTouchLeft;
    this.__initialTouchTop = currentTouchTop;

    // Store current zoom level
    this.__zoomLevelStart = this.__zoomLevel;

    // Store initial touch positions
    this.__lastTouchLeft = currentTouchLeft;
    this.__lastTouchTop = currentTouchTop;

    // Store initial move time stamp
    this.__lastTouchMove = insideTimeStamp;

    // Reset initial scale
    this.__lastScale = 1;

    // Reset locking flags
    this.__enableScrollX = !isSingleTouch && this.options.scrollingX;
    this.__enableScrollY = !isSingleTouch && this.options.scrollingY;

    // Reset tracking flag
    this.__isTracking = true;

    // Reset deceleration complete flag
    this.__didDecelerationComplete = false;

    // Dragging starts directly with two fingers, otherwise lazy with an offset
    this.__isDragging = !isSingleTouch;

    // Some features are disabled in multi touch scenarios
    this.__isSingleTouch = isSingleTouch;

    // Clearing data structure
    this.__positions = [];
  }

  /**
   * Touch move handler for scrolling support
   */
  doTouchMove(touches, timeStamp, scale) {
    let insideTimeStamp = timeStamp;

    // Array-like check is enough here
    if (touches.length == null) {
      throw new Error(`Invalid touch list: ${touches}`);
    }

    if (insideTimeStamp instanceof Date) {
      insideTimeStamp = insideTimeStamp.valueOf();
    }
    if (typeof insideTimeStamp !== 'number') {
      throw new Error(`Invalid timestamp value: ${insideTimeStamp}`);
    }

    // Ignore event when tracking is not enabled (event might be outside of element)
    if (!this.__isTracking) {
      return;
    }

    let currentTouchLeft;
    let currentTouchTop;

    // Compute move based around of center of fingers
    if (touches.length === 2) {
      currentTouchLeft = Math.abs(touches[0].pageX + touches[1].pageX) / 2;
      currentTouchTop = Math.abs(touches[0].pageY + touches[1].pageY) / 2;
    } else {
      currentTouchLeft = touches[0].pageX;
      currentTouchTop = touches[0].pageY;
    }

    const positions = this.__positions;

    // Are we already is dragging mode?
    if (this.__isDragging) {
      // Compute move distance
      const moveX = currentTouchLeft - this.__lastTouchLeft;
      const moveY = currentTouchTop - this.__lastTouchTop;

      // Read previous scroll position and zooming
      let scrollLeft = this.__scrollLeft;
      let scrollTop = this.__scrollTop;
      let level = this.__zoomLevel;

      // Work with scaling
      if (scale != null && this.options.zooming) {
        const oldLevel = level;

        // Recompute level based on previous scale and new scale
        level = (level / this.__lastScale) * scale;

        // Limit level according to configuration
        level = Math.max(Math.min(level, this.options.maxZoom), this.options.minZoom);

        // Only do further compution when change happened
        if (oldLevel !== level) {
          // Compute relative event position to container
          const currentTouchLeftRel = currentTouchLeft - this.__clientLeft;
          const currentTouchTopRel = currentTouchTop - this.__clientTop;

          // Recompute left and top coordinates based on new zoom level
          scrollLeft = ((currentTouchLeftRel + scrollLeft) * level) / oldLevel
            - currentTouchLeftRel;
          scrollTop = ((currentTouchTopRel + scrollTop) * level) / oldLevel - currentTouchTopRel;

          // Recompute max scroll values
          this.__computeScrollMax(level);
        }
      }

      if (this.__enableScrollX) {
        scrollLeft -= moveX * this.options.speedMultiplier;
        const maxScrollLeft = this.__maxScrollLeft;

        if (scrollLeft > maxScrollLeft || scrollLeft < 0) {
          // Slow down on the edges
          if (this.options.bouncing) {
            scrollLeft += (moveX / 2) * this.options.speedMultiplier;
          } else if (scrollLeft > maxScrollLeft) {
            scrollLeft = maxScrollLeft;
          } else {
            scrollLeft = 0;
          }
        }
      }

      // Compute new vertical scroll position
      if (this.__enableScrollY) {
        scrollTop -= moveY * this.options.speedMultiplier;
        const maxScrollTop = this.__maxScrollTop;

        if (scrollTop > maxScrollTop || scrollTop < 0) {
          // Slow down on the edges
          if (this.options.bouncing) {
            scrollTop += (moveY / 2) * this.options.speedMultiplier;

            // Support pull-to-refresh (only when only y is scrollable)
            if (!this.__enableScrollX && this.__refreshHeight != null) {
              if (!this.__refreshActive && scrollTop <= -this.__refreshHeight) {
                this.__refreshActive = true;
                if (this.__refreshActivate) {
                  this.__refreshActivate();
                }
              } else if (this.__refreshActive && scrollTop > -this.__refreshHeight) {
                this.__refreshActive = false;
                if (this.__refreshDeactivate) {
                  this.__refreshDeactivate();
                }
              }
            }
          } else if (scrollTop > maxScrollTop) {
            scrollTop = maxScrollTop;
          } else {
            scrollTop = 0;
          }
        }
      }

      // Keep list from growing infinitely (holding min 10, max 20 measure points)
      if (positions.length > 60) {
        positions.splice(0, 30);
      }

      // Track scroll movement for decleration
      positions.push(scrollLeft, scrollTop, insideTimeStamp);

      // Sync scroll position
      this.__publish(scrollLeft, scrollTop, level);

      // Otherwise figure out whether we are switching into dragging mode now.
    } else {
      const minimumTrackingForScroll = this.options.locking ? 3 : 0;
      const minimumTrackingForDrag = 5;

      const distanceX = Math.abs(currentTouchLeft - this.__initialTouchLeft);
      const distanceY = Math.abs(currentTouchTop - this.__initialTouchTop);

      this.__enableScrollX = this.options.scrollingX && distanceX >= minimumTrackingForScroll;
      this.__enableScrollY = this.options.scrollingY && distanceY >= minimumTrackingForScroll;

      positions.push(this.__scrollLeft, this.__scrollTop, insideTimeStamp);

      this.__isDragging = (this.__enableScrollX || this.__enableScrollY)
        && (distanceX >= minimumTrackingForDrag || distanceY >= minimumTrackingForDrag);
      if (this.__isDragging) {
        this.__interruptedAnimation = false;
      }
    }

    // Update last touch positions and time stamp for next event
    this.__lastTouchLeft = currentTouchLeft;
    this.__lastTouchTop = currentTouchTop;
    this.__lastTouchMove = insideTimeStamp;
    this.__lastScale = scale;
  }

  /**
   * Touch end handler for scrolling support
   */
  doTouchEnd(timeStamp) {
    let insideTimeStamp = timeStamp;

    if (insideTimeStamp instanceof Date) {
      insideTimeStamp = insideTimeStamp.valueOf();
    }
    if (typeof insideTimeStamp !== 'number') {
      throw new Error(`Invalid timestamp value: ${insideTimeStamp}`);
    }

    // Ignore event when tracking is not enabled (no touchstart event on element)
    // This is required as this listener ('touchmove') sits on the document
    // and not on the element itself.
    if (!this.__isTracking) {
      return;
    }

    // Not touching anymore (when two finger hit the screen there are two touch end events)
    this.__isTracking = false;

    // Be sure to reset the dragging flag now. Here we also detect whether
    // the finger has moved fast enough to switch into a deceleration animation.
    if (this.__isDragging) {
      // Reset dragging flag
      this.__isDragging = false;

      // Start deceleration
      // Verify that the last move detected was in some relevant time frame
      if (
        this.__isSingleTouch
        && this.options.animating
        && insideTimeStamp - this.__lastTouchMove <= 100
      ) {
        // Then figure out what the scroll position was about 100ms ago
        const endPos = this.__positions.length - 1;
        let startPos = endPos;

        // Move pointer to position measured 100ms ago
        for (let i = endPos; i > 0 && this.__positions[i] > this.__lastTouchMove - 100; i -= 3) {
          startPos = i;
        }

        // If start and stop position is identical in a 100ms timeframe,
        // we cannot compute any useful deceleration.
        if (startPos !== endPos) {
          // Compute relative movement between these two points
          const timeOffset = this.__positions[endPos] - this.__positions[startPos];
          const movedLeft = this.__scrollLeft - this.__positions[startPos - 2];
          const movedTop = this.__scrollTop - this.__positions[startPos - 1];

          // Based on 50ms compute the movement to apply for each render step
          this.__decelerationVelocityX = (movedLeft / timeOffset) * (1000 / 60);
          this.__decelerationVelocityY = (movedTop / timeOffset) * (1000 / 60);

          // How much velocity is required to start the deceleration
          const minVelocityToStartDeceleration = this.options.paging
          || this.options.snapping ? 4 : 1;

          // Verify that we have enough velocity to start deceleration
          if (
            Math.abs(this.__decelerationVelocityX) > minVelocityToStartDeceleration
            || Math.abs(this.__decelerationVelocityY) > minVelocityToStartDeceleration
          ) {
            // Deactivate pull-to-refresh when decelerating
            if (!this.__refreshActive) {
              this.__startDeceleration(insideTimeStamp);
            }
          } else {
            this.options.scrollingComplete();
          }
        } else {
          this.options.scrollingComplete();
        }
      } else if (insideTimeStamp - this.__lastTouchMove > 100) {
        this.options.scrollingComplete();
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
        this.__publish(this.__scrollLeft, -this.__refreshHeight, this.__zoomLevel, true);

        if (this.__refreshStart) {
          this.__refreshStart();
        }
      } else {
        if (this.__interruptedAnimation || this.__isDragging) {
          this.options.scrollingComplete();
        }
        this.scrollTo(this.__scrollLeft, this.__scrollTop, true, this.__zoomLevel);

        // Directly signalize deactivation (nothing todo on refresh?)
        if (this.__refreshActive) {
          this.__refreshActive = false;
          if (this.__refreshDeactivate) {
            this.__refreshDeactivate();
          }
        }
      }
    }

    // Fully cleanup list
    this.__positions.length = 0;
  }

  /**
   ---------------------------------------------------------------------------
   PRIVATE API
   ---------------------------------------------------------------------------
   */

  /**
   * Applies the scroll position to the content element
   *
   * @param left {Number} Left scroll position
   * @param top {Number} Top scroll position
   * @param zoom
   * @param animate {Boolean?false} Whether animation should be used to move to the new coordinates
   */
  __publish(left, top, zoom, animate) {
    // Remember whether we had an animation,
    // then we try to continue based on the current "drive" of the animation
    const wasAnimating = this.__isAnimating;
    if (wasAnimating) {
      this.animate.stop(wasAnimating);
      this.__isAnimating = false;
    }

    if (animate && this.options.animating) {
      // Keep scheduled positions for scrollBy/zoomBy functionality
      this.__scheduledLeft = left;
      this.__scheduledTop = top;
      this.__scheduledZoom = zoom;

      const oldLeft = this.__scrollLeft;
      const oldTop = this.__scrollTop;
      const oldZoom = this.__zoomLevel;

      const diffLeft = left - oldLeft;
      const diffTop = top - oldTop;
      const diffZoom = zoom - oldZoom;

      const step = (percent, now, render) => {
        if (render) {
          this.__scrollLeft = oldLeft + diffLeft * percent;
          this.__scrollTop = oldTop + diffTop * percent;
          this.__zoomLevel = oldZoom + diffZoom * percent;

          // Push values out
          if (this.__callback) {
            this.__callback(this.__scrollLeft, this.__scrollTop, this.__zoomLevel);
          }
        }
      };

      const verify = (id) => this.__isAnimating === id;

      const completed = (renderedFramesPerSecond, animationId, wasFinished) => {
        if (animationId === this.__isAnimating) {
          this.__isAnimating = false;
        }
        if (this.__didDecelerationComplete || wasFinished) {
          this.options.scrollingComplete();
        }

        if (this.options.zooming) {
          this.__computeScrollMax();
          if (this.__zoomComplete) {
            this.__zoomComplete();
            this.__zoomComplete = null;
          }
        }
      };

      // When continuing based on previous animation we choose an ease-out animation
      // instead of ease-in-out
      this.__isAnimating = this.animate.start(
        step,
        verify,
        completed,
        this.options.animationDuration,
        wasAnimating ? easeOutCubic : easeInOutCubic,
      );
    } else {
      this.__scheduledLeft = left;
      this.__scrollLeft = left;
      this.__scheduledTop = top;
      this.__scrollTop = top;
      this.__scheduledZoom = zoom;
      this.__zoomLevel = zoom;

      // Push values out
      if (this.__callback) {
        this.__callback(left, top, zoom);
      }

      // Fix max scroll ranges
      if (this.options.zooming) {
        this.__computeScrollMax();
        if (this.__zoomComplete) {
          this.__zoomComplete();
          this.__zoomComplete = null;
        }
      }
    }
  }

  /**
   * Recomputes scroll minimum values based on client dimensions and content dimensions.
   */
  __computeScrollMax(zoomLevel) {
    let insideZoomLevel = zoomLevel;

    if (insideZoomLevel == null) {
      insideZoomLevel = this.__zoomLevel;
    }

    this.__maxScrollLeft = Math.max(this.__contentWidth * insideZoomLevel - this.__clientWidth, 0);
    this.__maxScrollTop = Math.max(this.__contentHeight * insideZoomLevel - this.__clientHeight, 0);
  }

  /**
   ---------------------------------------------------------------------------
   ANIMATION (DECELERATION) SUPPORT
   ---------------------------------------------------------------------------
   */

  /**
   * Called when a touch sequence end and the speed of the finger was high enough
   * to switch into deceleration mode.
   */
  __startDeceleration() {
    if (this.options.paging) {
      const scrollLeft = Math.max(Math.min(this.__scrollLeft, this.__maxScrollLeft), 0);
      const scrollTop = Math.max(Math.min(this.__scrollTop, this.__maxScrollTop), 0);
      const clientWidth = this.__clientWidth;
      const clientHeight = this.__clientHeight;

      // We limit deceleration not to the min/max values of the allowed range,
      // but to the size of the visible client area.
      // Each page should have exactly the size of the client area.
      this.__minDecelerationScrollLeft = Math.floor(scrollLeft / clientWidth) * clientWidth;
      this.__minDecelerationScrollTop = Math.floor(scrollTop / clientHeight) * clientHeight;
      this.__maxDecelerationScrollLeft = Math.ceil(scrollLeft / clientWidth) * clientWidth;
      this.__maxDecelerationScrollTop = Math.ceil(scrollTop / clientHeight) * clientHeight;
    } else {
      this.__minDecelerationScrollLeft = 0;
      this.__minDecelerationScrollTop = 0;
      this.__maxDecelerationScrollLeft = this.__maxScrollLeft;
      this.__maxDecelerationScrollTop = this.__maxScrollTop;
    }

    // Wrap class method
    const step = (percent, now, render) => this.__stepThroughDeceleration(render);

    // How much velocity is required to keep the deceleration running
    const minVelocityToKeepDecelerating = this.options.snapping ? 4 : 0.001;

    // Detect whether it's still worth to continue animating steps
    // If we are already slow enough to not being user perceivable anymore,
    // we stop the whole process here.
    const verify = () => {
      const shouldContinue = Math.abs(this.__decelerationVelocityX) >= minVelocityToKeepDecelerating
        || Math.abs(this.__decelerationVelocityY) >= minVelocityToKeepDecelerating;
      if (!shouldContinue) {
        this.__didDecelerationComplete = true;
      }
      return shouldContinue;
    };

    const completed = () => {
      this.__isDecelerating = false;
      if (this.__didDecelerationComplete) {
        this.options.scrollingComplete();
      }

      // Animate to grid when snapping is active, otherwise just fix out-of-boundary positions
      this.scrollTo(this.__scrollLeft, this.__scrollTop, this.options.snapping);
    };

    // Start animation and switch on flag
    this.__isDecelerating = this.animate.start(step, verify, completed);
  }

  /**
   * Called on every step of the animation
   *
   * @param render
   */
  __stepThroughDeceleration(render) {
    //
    // COMPUTE NEXT SCROLL POSITION
    //

    // Add deceleration to scroll position
    let scrollLeft = this.__scrollLeft + this.__decelerationVelocityX;
    let scrollTop = this.__scrollTop + this.__decelerationVelocityY;

    //
    // HARD LIMIT SCROLL POSITION FOR NON BOUNCING MODE
    //

    if (!this.options.bouncing) {
      const scrollLeftFixed = Math.max(
        Math.min(this.__maxDecelerationScrollLeft, scrollLeft),
        this.__minDecelerationScrollLeft,
      );
      if (scrollLeftFixed !== scrollLeft) {
        scrollLeft = scrollLeftFixed;
        this.__decelerationVelocityX = 0;
      }

      const scrollTopFixed = Math.max(
        Math.min(this.__maxDecelerationScrollTop, scrollTop),
        this.__minDecelerationScrollTop,
      );
      if (scrollTopFixed !== scrollTop) {
        scrollTop = scrollTopFixed;
        this.__decelerationVelocityY = 0;
      }
    }

    //
    // UPDATE SCROLL POSITION
    //

    if (render) {
      this.__publish(scrollLeft, scrollTop, this.__zoomLevel);
    } else {
      this.__scrollLeft = scrollLeft;
      this.__scrollTop = scrollTop;
    }

    //
    // SLOW DOWN
    //

    // Slow down velocity on every iteration
    if (!this.options.paging) {
      // This is the factor applied to every iteration of the animation
      // to slow down the process. This should emulate natural behavior where
      // objects slow down when the initiator of the movement is removed
      const frictionFactor = 0.95;

      this.__decelerationVelocityX *= frictionFactor;
      this.__decelerationVelocityY *= frictionFactor;
    }

    //
    // BOUNCING SUPPORT
    //

    if (this.options.bouncing) {
      let scrollOutsideX = 0;
      let scrollOutsideY = 0;

      // This configures the amount of change applied to deceleration/acceleration
      // when reaching boundaries
      const { penetrationDeceleration, penetrationAcceleration } = this.options;

      // Check limits
      if (scrollLeft < this.__minDecelerationScrollLeft) {
        scrollOutsideX = this.__minDecelerationScrollLeft - scrollLeft;
      } else if (scrollLeft > this.__maxDecelerationScrollLeft) {
        scrollOutsideX = this.__maxDecelerationScrollLeft - scrollLeft;
      }

      if (scrollTop < this.__minDecelerationScrollTop) {
        scrollOutsideY = this.__minDecelerationScrollTop - scrollTop;
      } else if (scrollTop > this.__maxDecelerationScrollTop) {
        scrollOutsideY = this.__maxDecelerationScrollTop - scrollTop;
      }

      // Slow down until slow enough, then flip back to snap position
      if (scrollOutsideX !== 0) {
        if (scrollOutsideX * this.__decelerationVelocityX <= 0) {
          this.__decelerationVelocityX += scrollOutsideX * penetrationDeceleration;
        } else {
          this.__decelerationVelocityX = scrollOutsideX * penetrationAcceleration;
        }
      }

      if (scrollOutsideY !== 0) {
        if (scrollOutsideY * this.__decelerationVelocityY <= 0) {
          this.__decelerationVelocityY += scrollOutsideY * penetrationDeceleration;
        } else {
          this.__decelerationVelocityY = scrollOutsideY * penetrationAcceleration;
        }
      }
    }
  }
}
