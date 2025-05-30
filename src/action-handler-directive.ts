import { fireEvent, ActionHandlerOptions } from 'custom-card-helpers'
import { Directive, directive, Part, PartType } from 'lit/directive.js'

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

interface ActionHandlerElement extends Element {
  actionHandler?: boolean
}

class ActionHandler extends HTMLElement {
  public holdTime: number
  protected timer: number | undefined
  protected held: boolean
  protected cooldownStart: boolean
  protected cooldownEnd: boolean
  private dblClickTimeout: number | undefined

  constructor() {
    super()
    this.holdTime = 500
    this.timer = undefined
    this.held = false
    this.cooldownStart = false
    this.cooldownEnd = false
  }

  public connectedCallback(): void {
    Object.assign(this.style, {
      position: 'absolute',
      width: isTouch ? '100px' : '50px',
      height: isTouch ? '100px' : '50px',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    })

    const actions = ['touchcancel', 'mouseout', 'mouseup', 'touchmove', 'mousewheel', 'wheel', 'scroll']
    actions.forEach(ev => {
      document.addEventListener(
        ev,
        () => {
          clearTimeout(this.timer)
          this.stopAnimation()
          this.timer = undefined
        },
        { passive: true },
      )
    })
  }

  public bind(element: ActionHandlerElement, options: ActionHandlerOptions): void {
    if (element.actionHandler) {
      return
    }
    element.actionHandler = true

    element.addEventListener('contextmenu', (ev: Event) => {
      const e = ev || window.event
      if (e.preventDefault) {
        e.preventDefault()
      }
      if (e.stopPropagation) {
        e.stopPropagation()
      }
      e.cancelBubble = true
      e.returnValue = false
      return
    })

    const clickStart = (ev: Event): void => {
      if (this.cooldownStart) {
        return
      }
      this.held = false
      let x
      let y
      if ((ev as TouchEvent).touches) {
        x = (ev as TouchEvent).touches[0].pageX
        y = (ev as TouchEvent).touches[0].pageY
      } else {
        x = (ev as MouseEvent).pageX
        y = (ev as MouseEvent).pageY
      }

      this.timer = window.setTimeout(() => {
        this.startAnimation(x, y)
        this.held = true
      }, this.holdTime)

      this.cooldownStart = true
      window.setTimeout(() => (this.cooldownStart = false), 100)
    }

    const clickEnd = (ev: Event): void => {
      const actions = ['touchend', 'touchcancel']
      if (this.cooldownEnd || (actions.includes(ev.type) && this.timer === undefined)) {
        return
      }
      clearTimeout(this.timer)
      this.stopAnimation()
      this.timer = undefined
      if (this.held) {
        fireEvent(element as HTMLElement, 'action', { action: 'hold' })
      } else if (options.hasDoubleClick) {
        if ((ev as MouseEvent).detail === 1 || ev.type === 'keyup') {
          this.dblClickTimeout = window.setTimeout(() => {
            fireEvent(element as HTMLElement, 'action', { action: 'tap' })
          }, 250)
        } else {
          clearTimeout(this.dblClickTimeout)
          fireEvent(element as HTMLElement, 'action', { action: 'double_tap' })
        }
      } else {
        fireEvent(element as HTMLElement, 'action', { action: 'tap' })
      }
      this.cooldownEnd = true
      window.setTimeout(() => (this.cooldownEnd = false), 100)
    }

    const handleEnter = (ev: Event): void => {
      if ((ev as KeyboardEvent).keyCode === 13) {
        return clickEnd(ev)
      }
    }

    element.addEventListener('touchstart', clickStart, { passive: true })
    element.addEventListener('touchend', clickEnd)
    element.addEventListener('touchcancel', clickEnd)
    element.addEventListener('keyup', handleEnter)

    // iOS 13 sends a complete normal touchstart-touchend series of events followed by a mousedown-click series.
    // That might be a bug, but until it's fixed, this should make action-handler work.
    // If it's not a bug that is fixed, this might need updating with the next iOS version.
    // Note that all events (both touch and mouse) must be listened for in order to work on computers with both mouse and touchscreen.
    const isIOS13 = /iPhone OS 13_/.test(window.navigator.userAgent)
    if (!isIOS13) {
      element.addEventListener('mousedown', clickStart, { passive: true })
      element.addEventListener('click', clickEnd)
    }
  }

  private startAnimation(x: number, y: number): void {
    Object.assign(this.style, {
      left: `${x}px`,
      top: `${y}px`,
      display: null,
    })
  }

  private stopAnimation(): void {
    this.style.display = 'none'
  }
}

customElements.define('action-handler-bar', ActionHandler)

const getActionHandler = (): ActionHandler => {
  const body = document.body
  if (body.querySelector('action-handler-bar')) {
    return body.querySelector('action-handler-bar') as ActionHandler
  }

  const actionhandler = document.createElement('action-handler-bar')
  body.appendChild(actionhandler)

  return actionhandler as ActionHandler
}

export const actionHandlerBind = (element: ActionHandlerElement, options: ActionHandlerOptions): void => {
  const actionhandler: ActionHandler = getActionHandler()
  if (!actionhandler) {
    return
  }
  actionhandler.bind(element, options)
}

class ActionHandlerDirective extends Directive {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(part: Part, [element, options]: [Element, ActionHandlerOptions]) {
    if (part.type === PartType.ELEMENT) {
      actionHandlerBind(part.element, options);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  render(element: ActionHandlerElement, options: ActionHandlerOptions) {
    return;
  }
}

export const actionHandler = directive(ActionHandlerDirective);