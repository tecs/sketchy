import UILabel from './label.js';
import UIButton from './button.js';
import UIInput from './input.js';
import UIColorPicker from './color-picker.js';
import UIContainer, { UIPlainContainer } from './container.js';
import UIGroup from './group.js';
import UITable from './table.js';
import UIDialog from './dialog.js';
import UITabs from './tabs.js';
import UIMenu from './menu.js';
import UIWindow from './window.js';

UIContainer.setTypes({
  UILabel,
  UIButton,
  UIInput,
  UIColorPicker,
  UIPlainContainer,
  UIGroup,
  UITable,
  UIDialog,
  UITabs,
  UIMenu,
  UIWindow,
});

export { default as UIElement, $ } from './element.js';
export { default as UILabel } from './label.js';
export { default as UIButton } from './button.js';
export { default as UIInput } from './input.js';
export { default as UIColorPicker } from './color-picker.js';
export { default as UIContainer, UIPlainContainer } from './container.js';
export { default as UIGroup } from './group.js';
export { default as UITable } from './table.js';
export { default as UIDialog } from './dialog.js';
export { default as UITabs } from './tabs.js';
export { default as UIMenu } from './menu.js';
export { default as UIWindow } from './window.js';

/** @typedef {keyof HTMLElementTagNameMap} HTMLTag */
/** @typedef {HTMLTag | HTMLElement} HTMLElementRepresentation */
/** @typedef {import("./element.js").default<HTMLTag>} AnyUIElement */
/** @typedef {UIContainer<HTMLTag>} AnyUIContainer */
/** @typedef {AnyUIContainer | null | undefined} AnyUIParent */
/** @typedef {UITable<number>} AnyUITable */
/** @typedef {import("./tabs.js")._UITab} UITab */
/** @typedef {import("./table.js")._UICell} UICell */
/** @typedef {import("./table.js")._UIRow} UIRow */
