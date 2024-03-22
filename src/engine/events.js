/**
 * @typedef {import('./events-types').EngineEvent} EngineEvent
 * @typedef {{ event: EngineEvent['type'], handler: Function, once: boolean }} EventHandlerData
 */

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

  /** @type {EngineEvent["handler"]} */
  on = (event, handler, once = false) => {
    this.#handlers.push({ event, handler, once });
  };

  /** @type {EngineEvent["emitter"]} */
  emit = (event, ...args) => {
    /** @type {EventHandlerData[]} */
    const handlersToRemove = [];

    for (const handler of this.#handlers) {
      if (handler.event !== event) continue;
      try {
        handler.handler(...args);
      } catch (e) {
        // avoid infinite recursion
        if (event === 'error') {
          const error = new Error('fatal error');
          error.stack = [
            'fatal error',
            `Original Error: ${args[0]} ${/** @type {Error} */ (args[1])?.stack ?? args[1]}`,
            `Caused error inside error handler: ${/** @type {Error} */ (e)?.stack ?? e}`,
            `Caused ${error.stack}`,
          ].join('\n\n');
          throw error;
        }
        this.emit('error', `Caught inside handler for "${event}":`, e);
      }
      if (handler.once) handlersToRemove.push(handler);
    }

    if (handlersToRemove.length) this.#removeHandlers(handlersToRemove);
  };

  /**
   * @param {EngineEvent["type"]} event
   * @param {Function} handler
   */
  off(event, handler) {
    const handlersToRemove = this.#handlers.filter(h => h.event === event && h.handler === handler);
    if (handlersToRemove.length) this.#removeHandlers(handlersToRemove);
  }

  /**
   * @param {EngineEvent["type"]} event
   * @returns {Function[]}
   */
  list(event) {
    return this.#handlers.filter(h => h.event === event).map(h => h.handler);
  }
}
