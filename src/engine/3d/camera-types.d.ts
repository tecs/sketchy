import type { Event } from '../general/events-types';

type ViewportResizeEvent = Event<'viewportresize', [current: ReadonlyVec3, previous: ReadonlyVec3]>;
type CameraChangeEvent = Event<'camerachange'>;

export type CameraEvent = ViewportResizeEvent | CameraChangeEvent;
