import { Mapping } from "./base.js";

export type Args<
  T extends Mapping,
  Key extends keyof T = Exclude<{[K in keyof T]: [K, ConstructorParameters<T[K]>] }[keyof T], [keyof T, []]>[0],
> = {
  [K in Key]: ConstructorParameters<T[K]>;
};
