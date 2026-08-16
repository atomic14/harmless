// Make text that came from outside this codebase safe to put in HTML.
//
// One home, because there are two surfaces painting the same generated prose
// now: the game's DATA ON page (ui/screens.ts) and the encyclopaedia.
//
// It is not hypothetical. A generation run closed both of Tiraor's fields with
// a literal `</br>` (TODO 58). Without this, that would be markup rather than
// the five characters it is.
//
// The generator refuses an angle bracket as well. Neither guard makes the other
// redundant. One is the gate on what may be committed. The other is the render
// boundary, which declines to trust its input.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
