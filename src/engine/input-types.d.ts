import type { Event } from './general/events-types';

type MouseMoveEvent = Event<'keyup', [key: string]>;
type MouseScrollEvent = Event<'keydown', [key: string]>;
type MouseDownEvent = Event<'mouseup', [button: MouseButton]>;
type MouseUpEvent = Event<'mousedown', [button: MouseButton]>;
type KeyDownEvent = Event<'mousemove', [current: ReadonlyVec3, delta: ReadonlyVec3, previous: ReadonlyVec3]>;
type KeyUpEvent = Event<'mousescroll', [direction: -1 | 1]>;

export type InputEvent =
  MouseMoveEvent
  | MouseScrollEvent
  | MouseDownEvent
  | MouseUpEvent
  | KeyDownEvent
  | KeyUpEvent;
