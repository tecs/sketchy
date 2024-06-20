import type { EventType, MergedEvent } from './events-types';

export type InputEventType = MergedEvent<
  EventType<'keyup', [key: string]>
  | EventType<'keydown', [key: string]>
  | EventType<'mouseup', [button: MouseButton]>
  | EventType<'mousedown', [button: MouseButton]>
  | EventType<'mousemove', [current: ReadonlyVec3, delta: ReadonlyVec3, previous: ReadonlyVec3]>
  | EventType<'mousescroll', [direction: -1 | 1]>
>;
