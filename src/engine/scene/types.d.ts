import type { EventType, MergedEvent } from '../events-types';

export type SceneEvent = MergedEvent<
  EventType<'scenechange', []>
  | EventType<'selectionchange', [current: Readonly<Instance> | null, previous: Readonly<Instance> | null]>
  | EventType<'currentchange', [current: Readonly<Instance> | null, previous: Readonly<Instance> | null]>
>;
