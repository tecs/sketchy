import Solver from './solver.js';
import defaultHandlers from './handlers.js';
import defaultSyntax from './syntax.js';

export default () => new Solver(defaultSyntax, defaultHandlers);
