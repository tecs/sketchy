import type { Event } from '../general/events-types';
type CurrentChangeEvent = Event<'scenechange', []>;
type SelectionChangeEvent = Event<'selectionchange', [current: Readonly<Instance> | null, previous: Readonly<Instance> | null]>;
type SceneChangeEvent = Event<'currentchange', [current: Readonly<Instance> | null, previous: Readonly<Instance> | null]>;

export type SceneEvent =
  CurrentChangeEvent
  | SelectionChangeEvent
  | SceneChangeEvent;
