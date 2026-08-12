// The tech level scale: the shown range that every system's byte can encode.
//
// galaxy/galaxy.ts computes a raw zero-based `techLevel` of 0-14. Every reader
// adds one before it shows the value, which turns it into the shown 1-15. The
// ceiling is a literal with its derivation written out. It is not a read of the
// algorithm, because this directory may not import galaxy.ts.

/** The lowest tech level any system shows. */
export const TECH_MIN = 1;

/** The highest. The algorithm's own ceiling is 14, and it shows as 15. */
export const TECH_MAX = 15;
