// Flying by touch: the one number the finger's stick needs (docs/TODO/204).

/**
 * How far a steering finger travels from where it landed for full
 * deflection, in CSS pixels. It is 125, which is about a thumb's
 * comfortable reach on a phone held in one hand. The mouse stick uses 450 pixels of
 * travel, because a mouse crosses a desk. A thumb crosses a third of a
 * phone's width.
 *
 * @domain touch
 * @rule touch.stickTravel
 */
export const TOUCH_STICK_TRAVEL = 125;
