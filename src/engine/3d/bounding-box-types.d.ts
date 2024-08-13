import type { Event } from '../general/events-types';
import BoundingBox from './bounding-box.js';

type BoundedEntity = { BoundingBox: BoundingBox }

type BoundingBoxUpdatedEvent = Event<'boundingboxupdated', [entity: BoundedEntity]>;

export type BoundingBoxEvent = BoundingBoxUpdatedEvent;
