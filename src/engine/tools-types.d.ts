import type { Event } from './general/events-types';

type ToolActiveEvent = Event<'toolchange', [current: Readonly<AnyTool> | null, previous: Readonly<AnyTool> | null]>;
type ToolChangeEvent = Event<'toolactive', [tool: Readonly<AnyTool>]>;
type ToolInactiveEvent = Event<'toolinactive', [tool: Readonly<AnyTool> | null]>;

export type ToolEvent =
  ToolActiveEvent
  | ToolChangeEvent
  | ToolInactiveEvent;
