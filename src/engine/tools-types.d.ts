import type { Event } from './general/events-types';
type ToolActiveEvent = Event<'toolchange', [current: Readonly<Tool>, previous: Readonly<Tool> | null]>;
type ToolChangeEvent = Event<'toolactive', [tool: Readonly<Tool>]>;
type ToolInactiveEvent = Event<'toolinactive', [tool: Readonly<Tool> | null]>;

export type ToolEvent =
  ToolActiveEvent
  | ToolChangeEvent
  | ToolInactiveEvent;
