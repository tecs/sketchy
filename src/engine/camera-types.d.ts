import type { EventType, MergedEvent } from './events-types';

export type CameraEvent = MergedEvent<
  EventType<'viewportresize', [current: Readonly<vec3>, previous: Readonly<vec3>]>
  | EventType<'camerachange', []>
>;
