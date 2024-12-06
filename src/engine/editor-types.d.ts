import type { Event } from './general/events-types';
import { Element } from './editor.js';

type ChangeEventProps = [current: Readonly<Element>[], previous: Readonly<Element>[]];
type SelectionChangeEvent = Event<'selectionchange', ChangeEventProps>;
type CursorChangeEvent = Event<'cursorchange', [cursor?: string]>;

export type EditorEvent = SelectionChangeEvent | CursorChangeEvent;
