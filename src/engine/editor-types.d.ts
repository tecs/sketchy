import type { Event } from './general/events-types';
import { Collection, CopyActionData, Element } from './editor.js';
import { HistoryAction } from './history.js';
import { getCursor } from '../ui/assets.js';

type ChangeEventProps = [current: Readonly<Element>[], previous: Readonly<Element>[]];
type SelectionChangeEvent = Event<'selectionchange', ChangeEventProps>;
type CursorChangeEvent = Event<'cursorchange', [cursor?: Parameters<typeof getCursor>[0]]>;
type CopyEvent = Event<'copy', [Collection]>;
type PasteEvent = Event<'paste', [HistoryAction<Readonly<CopyActionData>>]>;

export type EditorEvent = SelectionChangeEvent | CursorChangeEvent | CopyEvent | PasteEvent;
