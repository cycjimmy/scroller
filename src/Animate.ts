/*
 * Scroller
 * http://github.com/cycjimmy/scroller
 *
 * Based on zynga/scroller
 * http://github.com/zynga/scroller
 * Copyright 2011, Zynga Inc.
 * Licensed under the MIT License.
 */
import type { EasingFunction } from './easing.js'
import requestAnimationFrame from './requestAnimationFrame.js'

/** Executed on every animation step; returning `false` stops the animation. */
export type AnimateStepCallback = (percent: number, now: number, render: boolean) => boolean | void

/** Executed before every animation step; returning `false` stops the animation. */
export type AnimateVerifyCallback = (id: number) => boolean

/** Executed once the animation ended, either finished or aborted. */
export type AnimateCompletedCallback = (
  renderedFramesPerSecond: number,
  animationId: number,
  wasFinished: boolean,
) => void

const desiredFrames = 60
const millisecondsPerSecond = 1000

/**
 * Generic animation class with support for dropped frames both optional easing and duration.
 *
 * Optional duration is useful when the lifetime is defined by another condition than time
 * e.g. speed of an animating object, etc.
 *
 * Dropped frame logic allows to keep using the same updater logic independent from the actual
 * rendering. This eases a lot of cases where it might be pretty complex to break down a state
 * based on the pure time difference.
 */
export default class Animate {
  /** Running animations, keyed by animation id. `null` marks a stopped one. */
  running: Record<number, boolean | null | undefined> = {}

  counter = 1

  /**
   * Stops the given animation.
   *
   * @param id Unique animation ID
   * @return Whether the animation was stopped (aka, was running before)
   */
  stop(id: number): boolean {
    const cleared = this.running[id] !== null
    if (cleared) {
      this.running[id] = null
    }

    return cleared
  }

  /**
   * Whether the given animation is still running.
   *
   * @param id Unique animation ID
   * @return Whether the animation is still running
   */
  isRunning(id: number): boolean {
    return this.running[id] !== null
  }

  /**
   * Start the animation.
   *
   * @param stepCallback Pointer to function which is executed on every step.
   * @param verifyCallback Executed before every animation step.
   * @param completedCallback Executed once the animation ended.
   * @param duration Milliseconds to run the animation
   * @param easingMethod Pointer to easing function
   * @param root Render root, when available. Used for internal usage of
   *   requestAnimationFrame.
   * @return Identifier of animation. Can be used to stop it any time.
   */
  start(
    stepCallback: AnimateStepCallback,
    verifyCallback?: AnimateVerifyCallback,
    completedCallback?: AnimateCompletedCallback,
    duration?: number,
    easingMethod?: EasingFunction,
    root?: HTMLElement,
  ): number {
    const start = Date.now()
    let lastFrame = start
    let percent = 0
    let dropCounter = 0
    const id = this.counter
    this.counter += 1
    const insideRoot = root ?? (typeof document === 'undefined'
      ? undefined
      : document.body)

    // Compacting running db automatically every few new animations
    if (id % 20 === 0) {
      const newRunning: Record<number, boolean | null> = {}
      Object.keys(this.running).forEach((usedId) => {
        newRunning[Number(usedId)] = true
      })

      this.running = newRunning
    }

    // This is the internal step method which is called every few milliseconds.
    // The environment calls it with a timestamp, so only the explicit `true`
    // passed by the dropped-frame loop marks a virtual (non-rendering) step.
    const step = (virtual?: unknown): void => {
      // Normalize virtual value
      const render = virtual !== true

      // Get current time
      const now = Date.now()

      // Verification is executed before next animation step
      if (!this.running[id] || (verifyCallback && !verifyCallback(id))) {
        this.running[id] = null
        completedCallback?.(
          desiredFrames - dropCounter / ((now - start) / millisecondsPerSecond),
          id,
          false,
        )
        return
      }

      // For the current rendering to apply let's update omitted steps in memory.
      // This is important to bring internal state variables up-to-date with progress in time.
      if (render) {
        const droppedFrames = Math.round(
          (now - lastFrame) / (millisecondsPerSecond / desiredFrames),
        ) - 1
        for (let j = 0; j < Math.min(droppedFrames, 4); j += 1) {
          step(true)
          dropCounter += 1
        }
      }

      // Compute percent value
      if (duration) {
        percent = (now - start) / duration
        if (percent > 1) {
          percent = 1
        }
      }

      // Execute step callback, then...
      const value = easingMethod
        ? easingMethod(percent)
        : percent
      if ((stepCallback(value, now, render) === false || percent === 1) && render) {
        this.running[id] = null
        completedCallback?.(
          desiredFrames - dropCounter / ((now - start) / millisecondsPerSecond),
          id,
          percent === 1 || duration == null,
        )
      }
      else if (render) {
        lastFrame = now
        requestAnimationFrame(step, insideRoot)
      }
    }

    // Mark as running
    this.running[id] = true

    // Init first step
    requestAnimationFrame(step, insideRoot)

    // Return unique animation ID
    return id
  }
}
