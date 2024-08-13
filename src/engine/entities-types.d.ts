import { Obj } from './entities.js';
import type { Event } from './general/events-types';

type EntityAddedEvent = Event<'entityadded', [entity: Obj]>;
type EntityRemovedEvent = Event<'entityremoved', [entity: Obj]>

export type EntitiesEvent = EntityAddedEvent | EntityRemovedEvent;
