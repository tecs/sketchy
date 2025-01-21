import { Constraints } from './constraints.js';
import Sketch from './sketch.js';

export type ExecArgs<T extends Constraints['type'], C extends Constraints = Find<Constraints, 'type', T>> = [
  pairs: C['indices'][],
  data: (C['data'] | undefined)[],
  type: T,
  sketch: Sketch,
];
