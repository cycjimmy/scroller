/*
 * Scroller
 * http://github.com/cycjimmy/scroller
 *
 * Based on zynga/scroller
 * http://github.com/zynga/scroller
 * Copyright 2011, Zynga Inc.
 * Licensed under the MIT License.
 */
import entries from '@cycjimmy/awesome-js-funcs/esm/object/entries';
import requestAnimationFrame from './requestAnimationFrame';

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
const time = Date.now || (() => +new Date());
const desiredFrames = 60;
const millisecondsPerSecond = 1000;

export default class Animate {
  constructor() {
    this.running = {};
    this.counter = 1;
  }

  /**
   * Stops the given animation.
   *
   * @param id {Integer} Unique animation ID
   * @return {Boolean} Whether the animation was stopped (aka, was running before)
   */
  stop(id) {
    const cleared = this.running[id] !== null;
    if (cleared) {
      this.running[id] = null;
    }

    return cleared;
  }

  /**
   * Whether the given animation is still running.
   *
   * @param id {Integer} Unique animation ID
   * @return {Boolean} Whether the animation is still running
   */
  isRunning(id) {
    return this.running[id] !== null;
  }

  /**
   * Start the animation.
   *
   * @param stepCallback {Function} Pointer to function which is executed on every step.
   *   Signature of the method should be `function(percent, now, virtual) {
   *    return continueWithAnimation;
   *   }`
   * @param verifyCallback {Function} Executed before every animation step.
   *   Signature of the method should be `function() { return continueWithAnimation; }`
   * @param completedCallback {Function}
   *   Signature of the method should be `function(droppedFrames, finishedAnimation) {}`
   * @param duration {Integer} Milliseconds to run the animation
   * @param easingMethod {Function} Pointer to easing function
   *   Signature of the method should be `function(percent) { return modifiedValue; }`
   * @param root {Element ? document.body} Render root, when available. Used for internal
   *   usage of requestAnimationFrame.
   * @return {Integer} Identifier of animation. Can be used to stop it any time.
   */
  start(stepCallback, verifyCallback, completedCallback, duration, easingMethod, root) {
    const start = time();
    let lastFrame = start;
    let percent = 0;
    let dropCounter = 0;
    const id = this.counter;
    this.counter += 1;
    let insideRoot = root;

    if (!insideRoot) {
      insideRoot = document.body;
    }

    // Compacting running db automatically every few new animations
    if (id % 20 === 0) {
      const newRunning = {};
      entries(this.running).forEach(([usedId]) => {
        newRunning[usedId] = true;
      });

      this.running = newRunning;
    }

    // This is the internal step method which is called every few milliseconds
    const step = (virtual) => {
      // Normalize virtual value
      const render = virtual !== true;

      // Get current time
      const now = time();

      // Verification is executed before next animation step
      if (!this.running[id] || (verifyCallback && !verifyCallback(id))) {
        this.running[id] = null;
        // eslint-disable-next-line no-unused-expressions
        completedCallback
          && completedCallback(
            desiredFrames - dropCounter / ((now - start) / millisecondsPerSecond),
            id,
            false,
          );
        return;
      }

      // For the current rendering to apply let's update omitted steps in memory.
      // This is important to bring internal state variables up-to-date with progress in time.
      if (render) {
        const droppedFrames = Math.round(
          (now - lastFrame) / (millisecondsPerSecond / desiredFrames),
        ) - 1;
        for (let j = 0; j < Math.min(droppedFrames, 4); j += 1) {
          step(true);
          dropCounter += 1;
        }
      }

      // Compute percent value
      if (duration) {
        percent = (now - start) / duration;
        if (percent > 1) {
          percent = 1;
        }
      }

      // Execute step callback, then...
      const value = easingMethod ? easingMethod(percent) : percent;
      if ((stepCallback(value, now, render) === false || percent === 1) && render) {
        this.running[id] = null;
        // eslint-disable-next-line no-unused-expressions
        completedCallback
          && completedCallback(
            desiredFrames - dropCounter / ((now - start) / millisecondsPerSecond),
            id,
            percent === 1 || duration == null,
          );
      } else if (render) {
        lastFrame = now;
        requestAnimationFrame(step, insideRoot);
      }
    };

    // Mark as running
    this.running[id] = true;

    // Init first step
    requestAnimationFrame(step, insideRoot);

    // Return unique animation ID
    return id;
  }
}
