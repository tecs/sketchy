import type { EventType, MergedEvent } from './events-types';

export type InputEventType = MergedEvent<
  EventType<'keyup', [key: string]>
  | EventType<'keydown', [key: string]>
  | EventType<'mouseup', [button: MouseButton]>
  | EventType<'mousedown', [button: MouseButton]>
  | EventType<'mousemove', [current: Readonly<vec3>, delta: Readonly<vec3>, previous: Readonly<vec3>]>
>;
