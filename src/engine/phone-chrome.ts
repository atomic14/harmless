// The phone's chrome: no zoom, and no address bar (docs/TODO/220).
//
// Platform code, beside `browser-shell.ts`. `main.ts` calls the two at boot,
// and a headless game never sees them.
//
// TWO FIXES FOR EACH FAULT, because the phones differ. The viewport meta
// and `touch-action` refuse a pinch and a double tap where a browser honours
// them. The iPhone honours neither in full, so the listeners below cancel
// the gesture itself. A web app manifest hides the address bar once the page
// is on the home screen. Android's browser also hides it on a fullscreen
// request, which the iPhone does not offer, so the request is a try.

/** Cancel a pinch and a double tap that the stylesheet could not refuse. */
export function holdZoom(doc: Document = document): void {
  // Safari's proprietary gesture events carry the pinch on the iPhone.
  doc.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  doc.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  // A two-finger move is a pinch. The event's `scale` is Safari's, and a
  // browser without it reports one finger per touch instead.
  doc.addEventListener('touchmove', (e) => {
    const scale = (e as TouchEvent & { scale?: number }).scale;
    if ((scale !== undefined && scale !== 1) || e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  // A second tap inside the double tap window is a zoom on the iPhone.
  let last = 0;
  doc.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - last < 300) e.preventDefault();
    last = now;
  }, { passive: false });
}

/**
 * Ask for the whole screen on the first touch, on a coarse pointer alone. A
 * desktop click never asks. A refusal is silent, because the manifest is the
 * fix that holds where the request does not exist.
 */
export function askFullscreen(doc: Document = document, win: Window = window): void {
  if (!win.matchMedia?.('(pointer: coarse)').matches) return;
  const ask = (): void => {
    const root = doc.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
    if (doc.fullscreenElement || !root.requestFullscreen) return;
    root.requestFullscreen().catch(() => {});
  };
  doc.addEventListener('touchend', ask, { once: true, passive: true });
}
