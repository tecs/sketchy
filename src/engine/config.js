/**
 * @typedef Setting
 * @property {string} name
 * @property {number} value
 * @property {Function} save
 * @property {Function} reset
 *
 * @param {string} name
 * @param {() => number} getValue
 * @param {(value: number) => void} onSave
 * @returns {Setting}
 */
const makeSetting = (name, getValue, onSave) => {
  const setting = {
    name,
    save: () => onSave(setting.value),
    value: getValue(),
    reset() { setting.value = getValue(); },
  };
  return setting;
};

export default class Config {
  doubleClickDelay = 200;

  /**
   * @returns {Setting[]}
   */
  list() {
    return [
      makeSetting('Double click delay', () => this.doubleClickDelay, (value) => { this.doubleClickDelay = value; }),
    ];
  }
}
