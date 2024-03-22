import type { CameraEvent } from './camera-types';
import type { HistoryEvent } from './history-types';
import type { InputEventType } from './input-types';
import type { SceneEvent } from './scene/types';
import type { ToolEvent } from './tools/types';

type UnionToIntersection<U> = (U extends unknown ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never;

type EventType<E extends string, P extends unknown[]> = {
  type: E;
  emitter: (event: E, ...args: P) => void;
  handler: (event: E, handler: (...args: P) => void, once?: boolean) => void;
};

type MergedEvent<E extends { type: string, emitter: E['emitter'], handler: E['handler'] }> = {
  type: E['type'];
  emitter: UnionToIntersection<E['emitter']>;
  handler: UnionToIntersection<E['handler']>;
};

type SystemError = EventType<'error', [message: string, detals: unknown]>;
type UserError = EventType<'usererror', [message: string]>;

type EngineEvent = MergedEvent<
  SystemError
  | UserError
  | HistoryEvent
  | CameraEvent
  | ToolEvent
  | InputEventType
  | SceneEvent
>;
