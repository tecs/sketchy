import type { EventType, MergedEvent } from '../events-types';

export type ToolEvent = MergedEvent<
  EventType<'toolchange', [current: Readonly<Tool>, previous: Readonly<Tool>]>
  | EventType<'toolactive', [tool: Readonly<Tool>]>
  | EventType<'toolinactive', [tool: Readonly<Tool>]>
>;
