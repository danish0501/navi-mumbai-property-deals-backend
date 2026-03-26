'use strict';

/**
 * Convert a string to a URL-safe kebab-case slug.
 * e.g.  "2 BHK Flat in Kharghar!" → "2-bhk-flat-in-kharghar"
 *
 * @param {string} text
 * @returns {string}
 */
const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')       // spaces / underscores → hyphen
    .replace(/[^\w-]+/g, '')       // remove non-word chars
    .replace(/--+/g, '-')          // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');      // trim leading/trailing hyphens

module.exports = slugify;
