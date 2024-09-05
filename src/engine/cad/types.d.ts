import Body, { AnyStep } from '../cad/body.js';
import type { Event } from '../general/events-types';
type StepEditedEvent = Event<'stepedited', [step: AnyStep]>;
type BodyEditedEvent = Event<'bodyedited', [step: Body]>;

export type CadEvent = StepEditedEvent | BodyEditedEvent;
