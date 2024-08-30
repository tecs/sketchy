import type { Event } from './general/events-types';

type MouseMoveEvent = Event<'keyup', [key: string, keyCombo: string]>;
type MouseScrollEvent = Event<'keydown', [key: string, keyCombo: string]>;
type MouseDownEvent = Event<'mouseup', [button: MouseButton, count: number]>;
type MouseUpEvent = Event<'mousedown', [button: MouseButton, count: number]>;
type KeyDownEvent = Event<'mousemove', [current: ReadonlyVec3, delta: ReadonlyVec3, previous: ReadonlyVec3]>;
type KeyUpEvent = Event<'mousescroll', [direction: -1 | 1]>;

export type InputEvent =
  MouseMoveEvent
  | MouseScrollEvent
  | MouseDownEvent
  | MouseUpEvent
  | KeyDownEvent
  | KeyUpEvent;
