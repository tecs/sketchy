type Callback<P extends unknown[]> = (...args: P) => void;

export type Event<T extends string, P extends unknown[]> = {
  type: T;
  params: P;
  callback: Callback<P>;
  emitter: (event: T, ...args: P) => void;
  handler: (event: T, handler: Callback<P>, once?: boolean) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEvent = Event<any, any[]>;

type SystemError = Event<'error', [message: string, details: unknown]>;
type UserError = Event<'usererror', [message: string]>;

type EventMap<E extends AnyEvent> = { [K in E['type']]: Extract<E, { type: K }> };

export type BasedEvents<E extends AnyEvent> = EventMap<SystemError | UserError> & EventMap<E>;
