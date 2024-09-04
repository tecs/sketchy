import { AnyStep } from '../cad/body.js';
import type { Event } from '../general/events-types';
type CurrentChangeEvent = Event<'scenechange'>;
type SelectionChangeEvent = Event<'selectionchange', [current: Readonly<Instance> | null, previous: Readonly<Instance> | null]>;
type SceneChangeEvent = Event<'currentchange', [current: Readonly<Instance> | null, previous: Readonly<Instance> | null]>;
type StepChangeEvent = Event<'stepchange', [current: Readonly<AnyStep> | null, previous: Readonly<AnyStep> | null]>;

export type SceneEvent =
  CurrentChangeEvent
  | SelectionChangeEvent
  | SceneChangeEvent
  | StepChangeEvent;
