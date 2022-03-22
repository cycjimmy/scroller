// Easing Equations (c) 2003 Robert Penner, all rights reserved.
// Open source under the BSD License.

/**
 * @param pos {Number} position between 0 (start of effect) and 1 (end of effect)
 * */
export const easeOutCubic = (pos) => (pos - 1) ** 3 + 1;

/**
 * @param pos {Number} position between 0 (start of effect) and 1 (end of effect)
 * */
export const easeInOutCubic = (pos) => {
  let _pos = pos;
  _pos /= 0.5;

  if (_pos >= 1) {
    return 0.5 * ((_pos - 2) ** 3 + 2);
  }
  return 0.5 * _pos ** 3;
};
