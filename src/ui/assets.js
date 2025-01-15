/**
 * @typedef Cursor
 * @property {string} name
 * @property {string} fallback
 * @property {string} [data]
 * @property {number} [x]
 * @property {number} [y]
 */

/** @type {Cursor[]} */
const cursors = [
  { name: 'bucket', fallback: 'alias', x: 4, y: 29 },
  { name: 'eyedropper', fallback: 'crosshair', x: 7, y: 23 },
  { name: 'pull', fallback: 'row-resize', x: 16, y: 4 },
  { name: 'rotate', fallback: 'move' },
];

for (const cursor of cursors) {
  cursor.data = `/assets/${cursor.name}.svg`;
  fetch(cursor.data)
    .then(response => response.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onload = () => void(cursor.data = reader.result?.toString());
      reader.readAsDataURL(blob);
    });
}

/**
 * @param {string | Cursor["name"]} cursorType
 * @returns {string}
 */
export const getCursor = (cursorType) => {
  const cursor = cursors.find(({ name }) => name === cursorType);
  if (!cursor) return cursorType;

  return `url(${cursor.data}) ${cursor.x ?? 16} ${cursor.y ?? 16}, ${cursor.fallback}`;
};
