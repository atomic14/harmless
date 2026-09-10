// Where the gun axis sits on the screen: the centre of the view above the
// console (docs/TODO/200 M2).
//
// It was a constant, `SIGHT_Y` at 0.42, and a twin of it in the stylesheet.
// The value stood in for a desktop console of about a fifth of the height. A
// phone in portrait reflows the console to a third, and the centre moves. So
// the browser shell measures the console at each resize and asks this
// function. The render stack shifts the projection by the answer, and the
// crosshair reads the same answer through a custom property. One rule, one
// home, and no number to keep in step.
//
// It is pure and it runs under node, so a test pins it without a window.

/**
 * The fraction of the view's height, from the top, where the sight sits.
 *
 * @param consoleHeight the console's rendered height, in pixels; 0 for none
 * @param viewHeight the whole view's height, in pixels
 */
export function sightFraction(consoleHeight: number, viewHeight: number): number {
  if (!(viewHeight > 0)) return 0.5;
  const visible = Math.max(0, viewHeight - Math.max(0, consoleHeight));
  return (visible / viewHeight) / 2;
}
