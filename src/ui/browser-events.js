/**
 * @param {Engine} engine
 * @param {import(".").default<any>} ui
 */
export default (engine, ui) => {
  ui.canvas.addEventListener('wheel', ({ deltaY }) => engine.input.scroll(/** @type {-1|1} */ (Math.sign(deltaY))), { passive: true });

  ui.canvas.addEventListener('mousedown', ({ button, detail }) => engine.input.setButton(button, true, detail));
  ui.canvas.addEventListener('mouseup', ({ button, detail }) => engine.input.setButton(button, false, detail));

  ui.canvas.addEventListener('mousemove', (e) => engine.input.setPosition(e.clientX, e.clientY, e.movementX, e.movementY));

  const lastKeyState = { alt: false, ctrl: false, shift: false };
  /**
   * @param {boolean} down
   * @returns {(e: KeyboardEvent) => void} e
   */
  const keyHandler = (down) => ({ key, altKey, ctrlKey, shiftKey, target }) => {
    if (target instanceof HTMLInputElement && !key.startsWith('Arrow')) return;

    if (key === 'GroupNext') {
      shiftKey ||= down;
      altKey ||= down;
    }

    if (lastKeyState.alt !== altKey) engine.input.setKey('Alt', altKey);
    if (lastKeyState.ctrl !== ctrlKey) engine.input.setKey('Control', ctrlKey);
    if (lastKeyState.shift !== shiftKey) engine.input.setKey('Shift', shiftKey);
    if (key !== 'Alt' && key !== 'Control' && key !== 'Shift') engine.input.setKey(key, down);

    lastKeyState.alt = altKey;
    lastKeyState.ctrl = ctrlKey;
    lastKeyState.shift = shiftKey;
  };
  document.addEventListener('keydown', keyHandler(true));
  document.addEventListener('keyup', keyHandler(false));

  window.addEventListener('resize', engine.driver.resize);
  engine.driver.resize();
};
