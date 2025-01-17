/**
 * @typedef Cursor
 * @property {string} name
 * @property {string} fallback
 * @property {string} data
 * @property {number} x
 * @property {number} y
 * @property {string} css
 */

/**
 * @typedef Icon
 * @property {string} name
 * @property {string} text
 * @property {import("./lib/element").WritableCSSDeclaration} [style]
 */

/** @type {Record<string, string | undefined>} */
const assetCache = {};

/** @type {{ url: string, onLoad: (data: string) => void }[]} */
const pendingAssetHandlers = [];

/**
 * @param {string} url
 * @param {(data: string) => void} onLoad
 */
const loadAsset = (url, onLoad) => {
  const cachedData = assetCache[url];
  if (cachedData !== undefined) {
    onLoad(cachedData);
    return;
  }

  pendingAssetHandlers.push({ url, onLoad });

  if (url in assetCache) return;
  assetCache[url] = undefined;

  fetch(url)
    .then(response => response.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result?.toString();
        if (data === undefined) return;
        assetCache[url] = data;
        for (let i = pendingAssetHandlers.length - 1; i >= 0; --i) {
          const handler = pendingAssetHandlers[i];
          if (handler.url !== url) continue;
          handler.onLoad(data);
          pendingAssetHandlers.splice(i, 1);
        }
        onLoad(data);
      };
      reader.readAsDataURL(blob);
    });
};

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
  cursor.css = `${cursor.data} ${x} ${y}, ${fallback}`;

  loadAsset(url, data => {
    cursor.data = `url(${data})`;
    cursor.css = `${cursor.data} ${cursor.x} ${cursor.y}, ${cursor.fallback}`;
  });

  return cursor;
});

/** @type {Icon[]} */
const icons = [
  'orbit',
  'bucket',
  'eyedropper',
  'pull',
  'translate',
  'rotate',
  'scale',
  'pointer-simplified',
  'magnifying-glass',
  'line',
  'rect',
].map(name => {
  const url = `/assets/${name}.svg`;
  const icon = { name, text: '', style: { backgroundImage: `url(${url})` }};

  loadAsset(url, data => void(icon.style.backgroundImage = `url(${data})`));

  return icon;
});

/**
 * @param {string | Cursor["name"]} cursorType
 * @returns {string}
 */
export const getCursor = (cursorType) => {
  return cursors.find(({ name }) => name === cursorType)?.css ?? cursorType;
};

/**
 * @param {string} iconType
 * @returns {Icon}
 */
export const getIcon = (iconType) => {
  const icon = icons.find(({ name }) => name === iconType);
  if (icon) return icon;

  const newIcon = { name: iconType, text: iconType };
  icons.push(newIcon);
  return newIcon;
};
