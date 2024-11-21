import type { Event } from './general/events-types';
import type { Action } from './tools.js';

type ToolActiveEvent = Event<'toolchange', [current: Readonly<AnyTool> | null, previous: Readonly<AnyTool> | null]>;
type ToolChangeEvent = Event<'toolactive', [tool: Readonly<AnyTool>]>;
type ToolInactiveEvent = Event<'toolinactive', [tool: Readonly<AnyTool> | null]>;
type ContextActionsChangeEvent = Event<'contextactions', [actions: Action[] | null]>;
type ContextActionChangeEvent = Event<'contextactionchange', [action: Action | null]>;

export type ToolEvent =
  ToolActiveEvent
  | ToolChangeEvent
  | ToolInactiveEvent
  | ContextActionsChangeEvent
  | ContextActionChangeEvent;
