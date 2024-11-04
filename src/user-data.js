/**
 * @typedef UserData
 * @property {import('./engine/config.js').Override[]} config
 */

const USER_DATA_KEY = 'userData';

/**
 * @param {unknown} userData
 * @returns {userData is UserData}
 */
const isUserData = (userData) => {
  if (userData === null || typeof userData !== 'object') return false;
  if (!('config' in userData && Array.isArray(userData.config))) return false;
  return userData.config.every(o => o && typeof o === 'object' && typeof o.id === 'string' && 'value' in o);
};

/**
 * @returns {UserData}
 */
const loadUserData = () => {
  try {
    const userData = JSON.parse(localStorage.getItem(USER_DATA_KEY) ?? '');
    if (isUserData(userData)) return userData;
  } catch { /* user data corrupted */ }
  return { config: [] };
};

/**
 * @param {UserData} userData
 */
const saveUserData = (userData) => {
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
};

/**
 * @param {Engine} engine
 */
export default (engine) => {
  const userData = loadUserData();
  engine.config.import(userData.config);
  engine.on('settingchange', () => {
    userData.config = engine.config.export();
    saveUserData(userData);
  });
};
