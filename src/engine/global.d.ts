type Program = import('./driver').Program;
type GLBuffer = import('./driver').GLBuffer;
type MouseButton = import('./input').MouseButton;
type Tool<T extends import('./tools').PropertyData['type']> = import('./tools').Tool<T>;
type BaseTool = import('./tools').BaseTool;
type AnyTool = { [K in import('./tools').PropertyData["type"]]: Tool<K> }[import('./tools').PropertyData["type"]] | BaseTool;
type Model = import('./3d/model').default;
type Instance = import('./scene/instance').default;
type RenderingPass = import('./renderer').RenderingPass;
type Engine = import('.').default;
type Entities = import('./entities').default;

type Tuple<T, N extends number, A extends T[] = []> = A['length'] extends N ? A : Tuple<T, N, [...A, T]>;
type OptionalTuple<T, N extends number, A extends T[] = []> = A['length'] extends N ? A : A | OptionalTuple<T, N, [...A, T]>;
type IfEquals<X, Y, A, B = never> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;
type IfExtends<X, Y, A, B = never> = X extends Y ? A : B;
type WritableKeys<T> = {
  [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P>
}[keyof T];
type ReadonlyKeys<T> = {
  [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, never, P>
}[keyof T];
type Filter<T, F> = { [K in keyof T as T[K] extends F ? K : never]: T[K] };
type KeyFor<T, V> = { [K in keyof T]: T[K] extends V ? K : never}[keyof T];
type Find<U, K extends keyof U, V extends keyof M, M = {
  [T in U as T[K] extends string | number ? T[K] : never]: T
}> = M[V];
type Values<T> = T[keyof T];
type Remap<A extends (keyof M)[], K extends keyof U, U, M = {
  [T in U as T[K] extends string | number ? T[K] : never]: T
}> = { [KK in keyof A]: M[A[KK]] };
type Expand<A extends unknown[]> = { [K in keyof A]: A[K][] };
