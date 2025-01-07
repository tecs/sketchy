import { Properties } from '../../engine/general/properties.js';
import UIElement, { $ } from './element.js';

const ctx = new OffscreenCanvas(0, 0).getContext('2d');

/**
 * @param {string} color
 * @returns {string}
 */
const colorToHex = (color) => {
  if (ctx) {
    ctx.fillStyle = color;
    color = ctx.fillStyle;
  }
  if (color.startsWith('rgb')) {
    const components = /** @type {PlainVec3} */ (color.replace(/[^0-9.]+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 3)
      .map(v => parseInt(v, 10)));
    return Properties.stringifyColor(components);
  }
  return color.toUpperCase();
};

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {PlainVec3}
 */
const rgbToHsl = (r, g, b) => {
  r = Math.max(Math.min(r / 255, 1), 0);
  g = Math.max(Math.min(g / 255, 1), 0);
  b = Math.max(Math.min(b / 255, 1), 0);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  const sum = max + min;

  /** @type {PlainVec3} */
  const hsl = [0, 100, sum * 50];
  hsl[1] *= diff / (hsl[0] > 50 ? 2 - sum : sum);

  if (!diff) return hsl;

  if (max === r) hsl[0] = (g - b) / diff;
  else if (max === g) hsl[0] = (b - r) / diff + 2;
  else if (max === b) hsl[0] = (r - g) / diff + 4;

  hsl[0] *= 60;
  hsl[0] += 360;
  hsl[0] %= 360;

  return hsl;
};

/**
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @returns {string}
 */
const hslToHex = (h, s, v) => colorToHex(`hsl(${h}deg ${s}% ${v}%)`);

/** @augments UIElement<"div"> */
export default class UIColorPicker extends UIElement {
  /** @type {HTMLInputElement} */
  input;

  /** @type {HTMLDivElement} */
  #preview;

  /** @type {HTMLDivElement} */
  #square;

  /** @type {HTMLDivElement} */
  #hue;

  get value() {
    return this.input.value;
  }

  /**
   * @param {string} color
   */
  constructor(color) {
    const input = $('input', {
      onchange: () => this.setColor(this.input.value),
      onkeydown: (e) => {
        if (e.key === 'Enter') this.setColor(this.input.value);
      },
    });
    const square = $('div', {
      className: 'square',
      onmousedown: (e) => this.#pickSL(e),
      onmousemove: (e) => this.#pickSL(e),
    });
    const hue = $('div', {
      className: 'hue',
      onmousedown: (e) => this.#pickHue(e),
      onmousemove: (e) => this.#pickHue(e),
    });
    const preview = $('div', { className: 'preview' });

    super($('div', { className: 'colorPicker' }, [square, hue, input, preview]));

    this.input = input;
    this.#preview = preview;
    this.#square = square;
    this.#hue = hue;

    this.setColor(color);
  }

  select() {
    this.input.select();
  }

  /**
   * @param {string} color
   */
  setColor(color) {
    color = colorToHex(color);
    const parsedColor = Properties.parseColor(color);
    if (!parsedColor) return;

    this.input.value = color;
    this.#preview.style.backgroundColor = color;

    const [hue] = rgbToHsl(...parsedColor);
    const pureColor = hslToHex(hue, 100, 50);
    this.#square.style.backgroundColor = pureColor;
  }

  /**
   * @param {MouseEvent} e
   */
  #pickSL(e) {
    if (!(e.buttons & 1)) return;

    const color = this.value;
    const parsedColor = Properties.parseColor(color);
    if (!parsedColor) return;

    const { top, left, width, height } = this.#square.getBoundingClientRect();
    const white = (e.clientX - left) / width;
    const black = 1 - (e.clientY - top) / height;

    const [hue] = rgbToHsl(...parsedColor);
    const pureColor = hslToHex(hue, 100, 50);

    const parsedPureColor = Properties.parseColor(pureColor);
    if (!parsedPureColor) return;

    const rgb = /** @type {PlainVec3} */ (parsedPureColor.map(c => (c * white + 255 * (1 - white)) * black));

    this.setColor(Properties.stringifyColor(rgb));
  }

  /**
   * @param {MouseEvent} e
   */
  #pickHue(e) {
    if (!(e.buttons & 1)) return;

    const color = this.value;
    const parsedColor = Properties.parseColor(color);
    if (!parsedColor) return;

    const [, s, l] = rgbToHsl(...parsedColor);

    const { top, height } = this.#hue.getBoundingClientRect();
    const newHue = (360 * (e.clientY - top)) / height;

    this.setColor(hslToHex(newHue, s, l));
  }
}
