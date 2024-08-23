import UIElement, { $ } from './element.js';

/** @typedef {UIElement<HTMLElement>} AnyUIElement */

/**
 * @template {number} S
 * @typedef {typeof import(".").UITable<S>} UITable
 */

/**
 * @typedef UITypes
 * @property {typeof import(".").UILabel} UILabel
 * @property {typeof import(".").UIButton} UIButton
 * @property {typeof import(".").UIInput} UIInput
 * @property {typeof import(".").UIPlainContainer} UIPlainContainer
 * @property {typeof import(".").UIGroup} UIGroup
 * @property {typeof import(".").UITable} UITable
 * @property {typeof import(".").UIDialog} UIDialog
 * @property {typeof import(".").UITabs} UITabs
 * @property {typeof import(".").UIMenu} UIMenu
 * @property {typeof import(".").UIWindows} UIWindows
 */

/**
 * @template {HTMLElement} E
 * @template {HTMLElement} [C=E]
 * @augments UIElement<E>
 */
export default class UIContainer extends UIElement {
  /** @type {Set<AnyUIElement>} */
  children = new Set();

  /** @type {C} */
  container;

  /** @type {UITypes} */
  static #typeMap;

  /**
   * @param {E} element
   */
  constructor(element) {
    super(element);
    this.container = /** @type {C} */ ( /** @type {HTMLElement} */ (element));
  }

  /**
   * @param {UITypes} typeMap
   */
  static setTypes(typeMap) {
    this.#typeMap = typeMap;
  }

  /**
   * @template {keyof HTMLElementTagNameMap} TM
   * @template {keyof HTMLElementEventMap} EM
   * @param {Partial<C>} [attributes]
   * @param {(HTMLElement | import("./element.js").Opts<TM, EM>)[]} [children]
   * @returns {C}
   */
  $container(attributes = {}, children = []) {
    return /** @type {C} */ ($(this.container, attributes, children));
  }

  /**
   * @template {AnyUIElement} E
   * @param {E} child
   * @returns {E}
   */
  addChild(child) {
    child.remove();
    child.parent = this;
    this.container.appendChild(child.element);
    this.children.add(child);
    return child;
  }

  /**
   * @param {AnyUIElement} child
   * @returns {boolean}
   */
  removeChild(child) {
    if (this.children.delete(child)) {
      child.parent = null;
      child.element.remove();
      return true;
    }
    return false;
  }

  clearChildren() {
    for (const child of this.children) {
      this.removeChild(child);
    }
  }

  /**
   * @param  {ConstructorParameters<UITypes["UILabel"]>} params
   * @returns {InstanceType<UITypes["UILabel"]>}
   */
  addLabel(...params) {
    return this.addChild(new UIContainer.#typeMap.UILabel(...params));
  }

  /**
   * @param  {ConstructorParameters<UITypes["UIButton"]>} params
   * @returns {InstanceType<UITypes["UIButton"]>}
   */
  addButton(...params) {
    return this.addChild(new UIContainer.#typeMap.UIButton(...params));
  }

  /**
   * @param  {ConstructorParameters<UITypes["UIInput"]>} params
   * @returns {InstanceType<UITypes["UIInput"]>}
   */
  addInput(...params) {
    return this.addChild(new UIContainer.#typeMap.UIInput(...params));
  }

  /**
   * @param  {ConstructorParameters<UITypes["UIPlainContainer"]>} params
   * @returns {InstanceType<UITypes["UIPlainContainer"]>}
   */
  addContainer(...params) {
    return this.addChild(new UIContainer.#typeMap.UIPlainContainer(...params));
  }

  /**
   * @param  {ConstructorParameters<UITypes["UIGroup"]>} params
   * @returns {InstanceType<UITypes["UIGroup"]>}
   */
  addGroup(...params) {
    return this.addChild(new UIContainer.#typeMap.UIGroup(...params));
  }

  /**
   * @template {number} S
   * @param  {ConstructorParameters<UITable<S>>} params
   * @returns {InstanceType<UITable<S>>}
   */
  addTable(...params) {
    return this.addChild(new UIContainer.#typeMap.UITable(...params));
  }

  /**
   * @param  {ConstructorParameters<UITypes["UIDialog"]>} params
   * @returns {InstanceType<UITypes["UIDialog"]>}
   */
  addDialog(...params) {
    return this.addChild(new UIContainer.#typeMap.UIDialog(...params));
  }

  /**
   * @param  {ConstructorParameters<UITypes["UITabs"]>} params
   * @returns {InstanceType<UITypes["UITabs"]>}
   */
  addTabs(...params) {
    return this.addChild(new UIContainer.#typeMap.UITabs(...params));
  }

  /**
   * @param  {ConstructorParameters<UITypes["UIMenu"]>} params
   * @returns {InstanceType<UITypes["UIMenu"]>}
   */
  addMenu(...params) {
    return this.addChild(new UIContainer.#typeMap.UIMenu(...params));
  }

  /**
   * @param  {ConstructorParameters<UITypes["UIWindows"]>} params
   * @returns {InstanceType<UITypes["UIWindows"]>}
   */
  addWindows(...params) {
    return this.addChild(new UIContainer.#typeMap.UIWindows(...params));
  }
}

/** @augments UIContainer<HTMLDivElement> */
export class UIPlainContainer extends UIContainer {
  /**
   * @param {Partial<HTMLDivElement>} [opts]
   */
  constructor(opts) {
    super($('div', opts));
  }
}
