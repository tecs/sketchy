import { getIcon } from '../../assets.js';
import { $ } from '../../lib/element.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").AnyUIContainer} container
 */
export default (engine, container) => {
  const newFileIcon = getIcon('file-new');
  const saveFileIcon = getIcon('file-save');
  const openFileIcon = getIcon('file-open');

  let lastAction = -1;

  /**
   * @param {string} action
   * @param {() => (void | Promise<void>)} fn
   */
  const askIfShould = (action, fn) => {
    if (
      lastAction === engine.history.current
      || confirm(`The scene has unsaved changes. Are you sure you want to discard them and ${action}?`)
    ) {
      const res = fn();
      if (res) res.then(() => void(lastAction = engine.history.current));
      else lastAction = engine.history.current;
    }
  };

  container.addButton(newFileIcon.text, () => askIfShould('create a new file', () => engine.scene.reset()), 'New file')
    .$element({ style: newFileIcon.style });

  container.addButton(saveFileIcon.text, () => {
    const json = engine.scene.export();
    const data = btoa(unescape(encodeURIComponent(json)));
    $('a', { href: `data:text/plain;charset=utf8,${encodeURIComponent(data)}`, download: 'Untitled.scene' }).click();
    lastAction = engine.history.current;
  }, 'Save file').$element({ style: saveFileIcon.style });

  container.addButton(openFileIcon.text, () => askIfShould('open another file', () => new Promise((res) => {
    $('input', {
      type: 'file',
      accept: '.scene',
      onchange({ currentTarget: el }) {
        if (!(el instanceof HTMLInputElement) || !el.files?.length) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const json = decodeURIComponent(escape(atob(reader.result?.toString() ?? '')));
          engine.scene.import(json);
          res();
        });
        reader.readAsText(el.files[0]);
      },
    }).click();
  })), 'Load file').$element({ style: openFileIcon.style });

  window.addEventListener('beforeunload', e => {
    if (lastAction !== engine.history.current) {
      e.preventDefault();
      return '';
    }
  });
};
