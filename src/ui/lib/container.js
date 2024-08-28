import UIElement, { $ } from './element.js';

/** @typedef {import(".").AnyUIElement} AnyUIElement */
/** @typedef {import(".").HTMLTag} HTMLTag */
/** @typedef {import(".").HTMLElementRepresentation} HTMLElementRepresentation */

/**
 * @template {HTMLElementRepresentation} E
 * @typedef {import("./element.js").ConcreteHTMLElement<E>} ConcreteHTMLElement
 */

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
 * @property {typeof import(".").UIWindow} UIWindow
 */

/**
 * @template {HTMLTag} E
 * @template {HTMLTag} [C=E]
 * @augments UIElement<E>
 */
export default class UIContainer extends UIElement {
  /** @type {Set<AnyUIElement>} */
  children = new Set();

  /** @type {ConcreteHTMLElement<C>} */
  container;

  /** @type {UITypes} */
  static #typeMap;

  /**
   * @param {ConcreteHTMLElement<E>} element
   */
  constructor(element) {
    super(element);
    this.container = /** @type {ConcreteHTMLElement<C>} */ ( /** @type {HTMLElement} */ (element));
  }

  /**
   * @param {UITypes} typeMap
   */
  static setTypes(typeMap) {
    this.#typeMap = typeMap;
  }

  /**
   * @template {HTMLElementRepresentation} T
   * @param {import("./element.js").Opts<ConcreteHTMLElement<C>, T>[1]} [attributes]
   * @param {import("./element.js").Opts<ConcreteHTMLElement<C>, T>[2]} [children]
   * @returns {ConcreteHTMLElement<C>}
   */
  $container(attributes = {}, children = []) {
    return /** @type {ConcreteHTMLElement<C>} */ ($(this.container, attributes, children));
  }

  /**
   * @template {AnyUIElement} E
   * @param {E} child
   * @returns {E}
   */
  addChild(child) {
    child.setParent(this);
    this.children.add(child);
    return child;
  }

  /**
   * @param {AnyUIElement} child
   * @returns {boolean}
   */
  removeChild(child) {
    if (this.children.delete(child)) {
      child.setParent(null);
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
   * @param  {ConstructorParameters<UITypes["UIWindow"]>} params
   * @returns {InstanceType<UITypes["UIWindow"]>}
   */
  addWindow(...params) {
    return this.addChild(new UIContainer.#typeMap.UIWindow(...params));
  }
}

/** @augments UIContainer<"div"> */
export class UIPlainContainer extends UIContainer {
  /**
   * @param {Partial<HTMLDivElement>} [opts]
   */
  constructor(opts) {
    super($('div', opts));
  }
}
