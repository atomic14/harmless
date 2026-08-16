// The 1984 chart metric. Two numbers turn a pair of chart coordinates into a
// distance in tenths of a light year. A third is the span of the coordinate
// space every chart projects. The arithmetic is `distanceTenths` in
// galaxy/navigation.ts.
//
// A tenth of a light year is also the unit the fuel tank holds. So a jump's
// fare, and the reach of a full tank, are the same quantity as a chart
// distance. That is why there is no light-years-per-unit-of-fuel constant.

/**
 * Tenths of a light year in one unit of chart x. It is the scale that makes the
 * original's numbers come out: a full 70-tenth tank is the classic 7.0 LY. The
 * fuel-range marker is drawn at `fuel / TENTHS_PER_CHART_UNIT` chart units.
 */
export const TENTHS_PER_CHART_UNIT = 4;

/**
 * The asymmetry: chart y counts for half of chart x. It is the original's metric,
 * because its chart is drawn half-height. Both charts plot `y / CHART_Y_SQUASH`
 * for the same reason, which keeps the fuel marker a true circle.
 */
export const CHART_Y_SQUASH = 2;

/**
 * The width of the coordinate space that every chart projects. `StarSystem.x`
 * runs 0-255, the top byte of a 16-bit seed word, which is the original's chart
 * grid. Both charts fit the whole galaxy against it. That is what makes it a
 * rule, rather than a fact local to one drawing.
 */
export const CHART_SPAN_X = 256;

/**
 * The height — half the width. It restates `CHART_Y_SQUASH` as a span rather than
 * a divisor, so "the chart is drawn half-height" is one fact instead of two.
 */
export const CHART_SPAN_Y = CHART_SPAN_X / CHART_Y_SQUASH;

/**
 * The console's short-range chart: canvas px per chart unit. The range circle
 * bounds it, not taste. A full tank draws at
 * `(fuel / TENTHS_PER_CHART_UNIT) * LOCAL_SCALE` = 262px, which fits inside
 * `LOCAL_CANVAS`. Raise one, and you must raise the other, or the range clips.
 */
export const LOCAL_SCALE = 15;

/** Square, so a light year is the same number of pixels whichever way you go. */
export const LOCAL_CANVAS = 560;

/**
 * The galactic chart's canvas, in px. It has its own home because two things
 * now read it. The first is the markup that sizes the canvas. The second is the
 * conversion from pixels to chart units, which decides how near the pointer
 * must be to pick a trade lane. That conversion runs with no DOM to ask, in a
 * test and headless.
 *
 * `CHART_CANVAS_W / CHART_SPAN_X` is about 3 px a system. That is the whole
 * legibility budget that every chart overlay is designed against.
 */
export const CHART_CANVAS_W = 780;
/**
 * Its height. It is not `CHART_CANVAS_W / CHART_Y_SQUASH` (390). The extra 10 px
 * are margin for the 4.5 px marker on a system that sits at y 0 or 255. The
 * galactic chart is therefore very slightly taller than the metric alone would
 * make it, and it is NOT quite isotropic. That is a drawing decision, hence a
 * literal.
 */
export const CHART_CANVAS_H = 400;

/**
 * How near the pointer must come to a trade lane to be pointing AT it, in canvas
 * pixels. Each chart converts it to chart units, because one pixel is about 13x
 * more chart on the galactic view than on the short-range one.
 *
 * It is smaller than the 28 px a click snaps to a system by. Lanes are long
 * targets, and dozens of them are on screen. A generous radius would pick a
 * neighbouring lane while the pointer sat on a star.
 */
export const LANE_PICK_PX = 8;
