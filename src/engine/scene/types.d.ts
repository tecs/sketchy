import Body, { AnyStep } from '../cad/body.js';
import type { Event } from '../general/events-types';
import { SceneElements } from './index.js';
type CurrentChangeEvent = Event<'scenechange'>;
type SelectionChangeEvent = Event<'selectionchange', [current: Readonly<SceneElements>[], previous: Readonly<SceneElements>[]]>;
type SceneChangeEvent = Event<'currentchange', [current: Readonly<Instance> | null, previous: Readonly<Instance> | null]>;
type StepChangeEvent = Event<'stepchange', [current: Readonly<AnyStep> | null, previous: Readonly<AnyStep> | null]>;
type SelectedBodyChangeEvent = Event<'selectedbodychange', [current: Readonly<Body> | null, previous: Readonly<Body> | null]>;

export type SceneEvent =
  CurrentChangeEvent
  | SelectionChangeEvent
  | SceneChangeEvent
  | StepChangeEvent
  | SelectedBodyChangeEvent;
