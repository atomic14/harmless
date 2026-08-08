// The 1984 chart metric: the two numbers that turn a pair of chart coordinates
// into a distance in tenths of a light year, and the span of the coordinate
// space every chart projects. The arithmetic is `distanceTenths` in
// galaxy/navigation.ts.
//
// A tenth of a light year is also the unit the fuel tank holds, so a jump's
// fare and the reach of a full tank are the same quantity as a chart distance —
// which is why there is no light-years-per-unit-of-fuel constant.

/**
 * Tenths of a light year in one unit of chart x — the scale that makes the
 * original's numbers come out: a full 70-tenth tank is the classic 7.0 LY. The
 * fuel-range marker is drawn at `fuel / TENTHS_PER_CHART_UNIT` chart units.
 */
export const TENTHS_PER_CHART_UNIT = 4;

/**
 * The asymmetry: chart y counts for half of chart x. The original's metric,
 * because its chart is drawn half-height. Both charts plot `y / CHART_Y_SQUASH`
 * for the same reason, which keeps the fuel marker a true circle.
 */
export const CHART_Y_SQUASH = 2;

/**
 * The width of the coordinate space every chart projects: `StarSystem.x` runs
 * 0-255, the top byte of a 16-bit seed word — the original's chart grid.
 * Both charts fit the whole galaxy against it, which is what makes it a rule and
 * not a fact local to one drawing.
 */
export const CHART_SPAN_X = 256;

/**
 * The height — half the width. `CHART_Y_SQUASH` restated as a span rather than a
 * divisor, so "the chart is drawn half-height" is one fact instead of two.
 */
export const CHART_SPAN_Y = CHART_SPAN_X / CHART_Y_SQUASH;

/**
 * The console's short-range chart: canvas px per chart unit. Bounded by the
 * range circle, not taste: a full tank draws at
 * `(fuel / TENTHS_PER_CHART_UNIT) * LOCAL_SCALE` = 262px, which fits inside
 * `LOCAL_CANVAS`. Raise one and you must raise the other or the range clips.
 */
export const LOCAL_SCALE = 15;

/** Square, so a light year is the same number of pixels whichever way you go. */
export const LOCAL_CANVAS = 560;
