/**
 * @typedef Cursor
 * @property {string} name
 * @property {string} fallback
 * @property {string} data
 * @property {number} x
 * @property {number} y
 * @property {string} css
 */

/** @type {Cursor[]} */
const cursors = [
  { name: 'bucket', fallback: 'alias', x: 4, y: 29 },
  { name: 'eyedropper', fallback: 'crosshair', x: 7, y: 23 },
  { name: 'pull', fallback: 'row-resize', x: 16, y: 4 },
  { name: 'translate', fallback: 'move' },
  { name: 'rotate', fallback: 'move' },
  { name: 'scale', fallback: 'nesw-resize' },
  { name: 'draw', fallback: 'crosshair' },
  { name: 'draw-rect', fallback: 'crosshair' },
  { name: 'draw-line', fallback: 'crosshair' },
  { name: 'orbit', fallback: 'default' },
  { name: 'action-distance', fallback: 'context-menu', x: 4, y: 4 },
  { name: 'action-width', fallback: 'context-menu', x: 4, y: 4 },
  { name: 'action-height', fallback: 'context-menu', x: 4, y: 4 },
  { name: 'action-equal', fallback: 'context-menu', x: 4, y: 4 },
  { name: 'action-coincident', fallback: 'context-menu', x: 4, y: 4 },
  { name: 'action-horizontal', fallback: 'context-menu', x: 4, y: 4 },
  { name: 'action-vertical', fallback: 'context-menu', x: 4, y: 4 },
  { name: 'action-pull', fallback: 'move', x: 4, y: 4 },
  { name: 'action-translate', fallback: 'move', x: 4, y: 4 },
  { name: 'action-rotate', fallback: 'move', x: 4, y: 4 },
  { name: 'action-scale', fallback: 'move', x: 4, y: 4 },
].map(({ name, fallback, x = 16, y = 16 }) => {
  const url = `/assets/${name}.svg`;
  const cursor = { name, fallback, x, y, data: `url(${url})`, css: '' };
  cursor.css = `${cursor.data} ${cursor.x} ${cursor.y}, ${cursor.fallback}`;

  fetch(url)
    .then(response => response.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result?.toString();
        if (data === undefined) return;
        cursor.data = `url(${data})`;
        cursor.css = `${cursor.data} ${cursor.x} ${cursor.y}, ${cursor.fallback}`;
      };
      reader.readAsDataURL(blob);
    });

  return cursor;
});

/**
 * @param {string | Cursor["name"]} cursorType
 * @returns {string}
 */
export const getCursor = (cursorType) => {
  return cursors.find(({ name }) => name === cursorType)?.css ?? cursorType;
};
