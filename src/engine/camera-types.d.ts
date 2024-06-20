import type { EventType, MergedEvent } from './events-types';

export type CameraEvent = MergedEvent<
  EventType<'viewportresize', [current: ReadonlyVec3, previous: ReadonlyVec3]>
  | EventType<'camerachange', []>
>;
