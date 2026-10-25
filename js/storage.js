/**
 * storage.js — localStorage data layer
 * Exposes window.Storage with load(), save(data), generateId().
 * No side effects beyond localStorage access.
 */

window.Storage = {
  STORAGE_KEY: 'golfplaetze_v1',

  /**
   * Load the full data object from localStorage.
   * Returns a fresh default if nothing is stored or parsing fails.
   * @returns {{ version: number, courses: Array }}
   */
  load: function () {
    try {
      var raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Storage.load: failed to parse stored data', e);
    }
    return { version: 1, courses: [] };
  },

  /**
   * Persist the data object to localStorage.
   * @param {{ version: number, courses: Array }} data
   */
  save: function (data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  /**
   * Generate a unique string ID using timestamp + random suffix.
   * @returns {string}
   */
  generateId: function () {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
  }
};
