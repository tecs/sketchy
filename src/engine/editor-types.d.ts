import type { Event } from './general/events-types';
import { Elements } from './editor.js';

type ChangeEventProps = [current: Readonly<Elements>[], previous: Readonly<Elements>[]];
type SelectionChangeEvent = Event<'selectionchange', ChangeEventProps>;

export type EditorEvent = SelectionChangeEvent;
