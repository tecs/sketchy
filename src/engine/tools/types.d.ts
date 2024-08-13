import type { Event } from '../general/events-types';
type ToolActiveEvent = Event<'toolchange', [current: Readonly<Tool>, previous: Readonly<Tool>]>;
type ToolChangeEvent = Event<'toolactive', [tool: Readonly<Tool>]>;
type ToolInactiveEvent = Event<'toolinactive', [tool: Readonly<Tool>]>;

export type ToolEvent =
  ToolActiveEvent
  | ToolChangeEvent
  | ToolInactiveEvent;
