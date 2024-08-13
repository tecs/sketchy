import type { Event } from '../general/events-types';
type InstanceTransformedEvent = Event<'instancetransformed', [Instance, ReadonlyMat4]>;
type InstanceTranslatedEvent = Event<'instancetranslated', [Instance, ReadonlyVec3]>;

export type InstanceEvent = InstanceTransformedEvent | InstanceTranslatedEvent;
