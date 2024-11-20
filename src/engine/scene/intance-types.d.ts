import type { Event } from '../general/events-types';
type InstanceTransformedEvent = Event<'instancetransformed', [Instance, ReadonlyMat4]>;
type InstanceTranslatedEvent = Event<'instancetranslated', [Instance, ReadonlyVec3]>;
type InstanceScaledEvent = Event<'instancescaled', [Instance, ReadonlyVec3]>;
type InstanceEditedEvent = Event<'instanceedited', [Instance]>;

export type InstanceEvent =
  InstanceTransformedEvent
  | InstanceTranslatedEvent
  | InstanceScaledEvent
  | InstanceEditedEvent;
