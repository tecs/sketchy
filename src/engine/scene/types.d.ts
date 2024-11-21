import Body, { AnyStep } from '../cad/body.js';
import type { Event } from '../general/events-types';
type CurrentChangeEvent = Event<'scenechange'>;
type SceneChangeEvent = Event<'currentchange', [current: Readonly<Instance> | null, previous: Readonly<Instance> | null]>;
type StepChangeEvent = Event<'stepchange', [current: Readonly<AnyStep> | null, previous: Readonly<AnyStep> | null, selection: boolean]>;
type SelectedBodyChangeEvent = Event<'selectedbodychange', [current: Readonly<Body> | null, previous: Readonly<Body> | null]>;

export type SceneEvent =
  CurrentChangeEvent
  | SceneChangeEvent
  | StepChangeEvent
  | SelectedBodyChangeEvent;
