/* eslint-disable max-len */
/**
 * @typedef {{ event: EngineEvent, handler: Function, once: boolean }} EventHandlerData
 *
 * @typedef {"viewportresize"} ViewportResizeEvent
 * @typedef {"camerachange"} CameraChangeEvent
 * @typedef {"toolchange"} ToolChangeEvent
 * @typedef {"scenechange"} SceneChangeEvent
 * @typedef {"keyup"} KeyUpEvent
 * @typedef {"keydown"} KeyDownEvent
 * @typedef {"mouseup"} MouseUpEvent
 * @typedef {"mousedown"} MouseDownEvent
 * @typedef {"selectionchange"} SelectionChangeEvent
 * @typedef {"currentchange"} CurrentChangeEvent
 * @typedef {"mousemove"} MouseMoveEvent
 *
 * @typedef {KeyUpEvent|KeyDownEvent} KeyEvent
 * @typedef {MouseUpEvent|MouseDownEvent} MouseButtonEvent
 * @typedef {CameraChangeEvent|SceneChangeEvent} ParamlessEvent
 * @typedef {SelectionChangeEvent|CurrentChangeEvent} InstanceChangeEvent
 *
 * @typedef {MouseMoveEvent|InstanceChangeEvent|MouseButtonEvent|KeyEvent|ViewportResizeEvent|ToolChangeEvent|ParamlessEvent} EngineEvent
 *
 * @typedef {(event: ViewportResizeEvent, current: Readonly<vec3>, previous: Readonly<vec3>) => void} ViewportResizeEventEmitter
 * @typedef {(event: ToolChangeEvent, current: Readonly<Tool>, previous: Readonly<Tool>) => void} ToolChangeEventEmitter
 * @typedef {(event: InstanceChangeEvent, current: Readonly<Instance> | null, previous: Readonly<Instance> | null) => void} InstanceChangeEventEmitter
 * @typedef {(event: KeyEvent, key: string) => void} KeyEventEmitter
 * @typedef {(event: MouseButtonEvent, button: MouseButton) => void} MouseButtonEventEmitter
 * @typedef {(event: MouseMoveEvent, current: Readonly<vec3>, delta: Readonly<vec3>, previous: Readonly<vec3>) => void} MouseMoveEventEmitter
 * @typedef {(event: ParamlessEvent) => void} ParamlessEventEmitter
 *
 * @typedef {ViewportResizeEventEmitter&ToolChangeEventEmitter&InstanceChangeEventEmitter&KeyEventEmitter&MouseButtonEventEmitter&MouseMoveEventEmitter&ParamlessEventEmitter} EventEmitter
 *
 * @typedef {(event: ViewportResizeEvent, handler: (current: Readonly<vec3>, previous: Readonly<vec3>) => void, once?: boolean) => void} ViewportResizeEventHandler
 * @typedef {(event: ToolChangeEvent, handler: (current: Readonly<Tool>, previous: Readonly<Tool>) => void, once?: boolean) => void} ToolChangeEventHandler
 * @typedef {(event: InstanceChangeEvent, handler: (current: Readonly<Instance> | null, previous: Readonly<Instance> | null) => void, once?: boolean) => void} InstanceChangeEventHandler
 * @typedef {(event: KeyEvent, handler: (key: string) => void, once?: boolean) => void} KeyEventHandler
 * @typedef {(event: MouseButtonEvent, handler: (button: MouseButton) => void, once?: boolean) => void} MouseButtonEventHandler
 * @typedef {(event: MouseMoveEvent, handler: (current: Readonly<vec3>, delta: Readonly<vec3>, previous: Readonly<vec3>) => void, once?: boolean) => void} MouseMoveEventHandler
 * @typedef {(event: ParamlessEvent, handler: () => void, once?: boolean) => void} ParamlessEventHandler
 *
 * @typedef {ViewportResizeEventHandler&ToolChangeEventHandler&InstanceChangeEventHandler&KeyEventHandler&MouseButtonEventHandler&MouseMoveEventHandler&ParamlessEventHandler} EventHandler
 */
/* eslint-enable max-len */

export default class Events {
  /** @type {EventHandlerData[]} */
  #handlers = [];

  /**
   * @param {EventHandlerData[]} handlersToRemove
   */
  #removeHandlers(handlersToRemove) {
    for (const handler of handlersToRemove) {
      const index = this.#handlers.indexOf(handler);
      this.#handlers.splice(index, 1);
    }
  }

  /** @type {EventHandler} */
  on = (event, handler, once = false) => {
    this.#handlers.push({ event, handler, once });
  };

  /** @type {EventEmitter} */
  emit = (event, arg1 = undefined, arg2 = undefined, arg3 = undefined, arg4 = undefined) => {
    /** @type {EventHandlerData[]} */
    const handlersToRemove = [];

    for (const handler of this.#handlers) {
      if (handler.event !== event) continue;
      try {
        handler.handler(arg1, arg2, arg3, arg4);
      } catch (e) {
        console.error(`Caught inside handler for "${event}":`, e);
      }
      if (handler.once) handlersToRemove.push(handler);
    }

    if (handlersToRemove.length) this.#removeHandlers(handlersToRemove);
  };

  /**
   * @param {EngineEvent} event
   * @param {Function} handler
   */
  off(event, handler) {
    const handlersToRemove = this.#handlers.filter(h => h.event === event && h.handler === handler);
    if (handlersToRemove.length) this.#removeHandlers(handlersToRemove);
  }

  /**
   * @param {EngineEvent} event
   * @returns {Function[]}
   */
  list(event) {
    return this.#handlers.filter(h => h.event === event).map(h => h.handler);
  }
}
