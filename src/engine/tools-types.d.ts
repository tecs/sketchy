import type { Event } from './general/events-types';
import type { Action } from './tools.js';

type ToolChangeEvent = Event<'toolchange', [current: Readonly<AnyTool> | null, previous: Readonly<AnyTool> | null]>;
type ToolActiveEvent = Event<'toolactive', [tool: Readonly<AnyTool>]>;
type ToolInactiveEvent = Event<'toolinactive', [tool: Readonly<AnyTool> | null]>;
type ToolEnabledEvent = Event<'toolenabled', [tool: Readonly<AnyTool>]>;
type ToolDisabledEvent = Event<'tooldisabled', [tool: Readonly<AnyTool>]>;
type ContextActionsChangeEvent = Event<'contextactions', [actions: (Action|null)[] | null]>;
type ContextActionChangeEvent = Event<'contextactionchange', [action: Action | null]>;
type ContextActionActivateEvent = Event<'contextactionactivate', [action: Action]>;
type ContextActionDeactivateEvent = Event<'contextactiondeactivate', [action: Action]>;

export type ToolEvent =
  ToolActiveEvent
  | ToolChangeEvent
  | ToolInactiveEvent
  | ToolEnabledEvent
  | ToolDisabledEvent
  | ContextActionsChangeEvent
  | ContextActionChangeEvent
  | ContextActionActivateEvent
  | ContextActionDeactivateEvent;
