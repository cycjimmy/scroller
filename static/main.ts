import Scroller from '../src/index.js'

/** Fails loudly instead of running the demo against a missing element. */
function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id)

  if (!element) {
    throw new Error(`The demo markup is missing #${id}.`)
  }

  return element
}

const container = requireElement('container')
const content = requireElement('content')

/**
 * DOM-based rendering: a 3D transform when the engine supports it, which is
 * every browser the ES2015 build targets.
 */
function render(left: number, top: number, zoom: number): void {
  content.style.transform = `translate3d(${-left}px, ${-top}px, 0) scale(${zoom})`
}

// Content generator
const cellSize = 400
const fragment = document.createDocumentFragment()
const rowCount = content.clientHeight / cellSize

for (let row = 0; row < rowCount; row += 1) {
  const cell = document.createElement('div')
  cell.className = 'cell'
  cell.textContent = String(row)
  fragment.appendChild(cell)
}

content.appendChild(fragment)

// Initialize Scroller
const scroller = new Scroller(render, {
  scrollingX: false,
  paging: true,
})

// Setup Scroller
const rect = container.getBoundingClientRect()

scroller.setPosition(rect.left + container.clientLeft, rect.top + container.clientTop)
scroller.setDimensions(
  container.clientWidth,
  container.clientHeight,
  content.offsetWidth,
  content.offsetHeight,
)

// Don't react if the initial down happens on a form element
function isFormElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && /input|textarea|select/i.test(target.tagName)
}

// Event handler
if ('ontouchstart' in window) {
  container.addEventListener('touchstart', (e) => {
    if (isFormElement(e.target)) {
      return
    }

    scroller.doTouchStart(e.touches, e.timeStamp)
    e.preventDefault()
  }, false)

  document.addEventListener('touchmove', (e) => {
    scroller.doTouchMove(e.touches, e.timeStamp)
  }, false)

  document.addEventListener('touchend', (e) => {
    scroller.doTouchEnd(e.timeStamp)
  }, false)
}
else {
  let mouseDown = false

  container.addEventListener('mousedown', (e) => {
    if (isFormElement(e.target)) {
      return
    }

    scroller.doTouchStart([
      {
        pageX: e.pageX,
        pageY: e.pageY,
      },
    ], e.timeStamp)

    mouseDown = true
  }, false)

  document.addEventListener('mousemove', (e) => {
    if (!mouseDown) {
      return
    }

    scroller.doTouchMove([
      {
        pageX: e.pageX,
        pageY: e.pageY,
      },
    ], e.timeStamp)
  }, false)

  document.addEventListener('mouseup', (e) => {
    if (!mouseDown) {
      return
    }

    scroller.doTouchEnd(e.timeStamp)

    mouseDown = false
  }, false)
}
