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

  container.addButton(newFileIcon.text, () => engine.scene.reset(), 'New file').$element({ style: newFileIcon.style });
  container.addButton(saveFileIcon.text, () => {
    const json = engine.scene.export();
    const data = btoa(unescape(encodeURIComponent(json)));
    $('a', { href: `data:text/plain;charset=utf8,${encodeURIComponent(data)}`, download: 'Untitled.scene' }).click();
  }, 'Save file').$element({ style: saveFileIcon.style });
  container.addButton(openFileIcon.text, () => {
    $('input', {
      type: 'file',
      accept: '.scene',
      onchange({ currentTarget: el }) {
        if (!(el instanceof HTMLInputElement) || !el.files?.length) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const json = decodeURIComponent(escape(atob(reader.result?.toString() ?? '')));
          engine.scene.import(json);
        });
        reader.readAsText(el.files[0]);
      },
    }).click();
  }, 'Load file').$element({ style: openFileIcon.style });
};
