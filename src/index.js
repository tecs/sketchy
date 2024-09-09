import UI from './ui/index.js';
import Engine from './engine/index.js';

import renderAxis from './passes/axis.js';
import renderGrid from './passes/grid.js';
import renderSkybox from './passes/skybox.js';
import renderObjects from './passes/objects.js';
import renderLines from './passes/lines.js';
import renderPoints from './passes/points.js';
import extractId from './passes/extractId.js';
import extractPosition from './passes/extractPosition.js';

import LineTool from './tools/line.js';
import RectangleTool from './tools/rectangle.js';
import SelectTool from './tools/select.js';
import MoveTool from './tools/move.js';
import OrbitTool from './tools/orbit.js';
import ZoomTool from './tools/zoom.js';

import makeSystemMenu from './ui/menu/system/index.js';
import makeToolsMenu from './ui/menu/tools.js';
import makeBrowserMenu from './ui/menu/browser/index.js';
import makeInfoMenu from './ui/menu/info.js';

import connectEngineEvents from './ui/engine-events.js';
import connectBrowserEvents from './ui/browser-events.js';

window.addEventListener('load', () => {
  const ui = new UI(document.body);
  const engine = new Engine(ui.canvas);

  engine.renderer.addToPipeline(renderSkybox);
  engine.renderer.addToPipeline(renderObjects);
  engine.renderer.addToPipeline(renderLines);
  engine.renderer.addToPipeline(renderPoints);
  engine.renderer.addToPipeline(extractId);
  engine.renderer.addToPipeline(extractPosition);
  engine.renderer.addToPipeline(renderGrid);
  engine.renderer.addToPipeline(renderAxis);

  engine.tools.addTool(SelectTool);
  engine.tools.addTool(LineTool);
  engine.tools.addTool(RectangleTool);
  engine.tools.addTool(MoveTool);
  engine.tools.addTool(OrbitTool);
  engine.tools.addTool(ZoomTool);

  ui.addChild(makeSystemMenu(engine));
  ui.addChild(makeToolsMenu(engine));
  ui.addChild(makeBrowserMenu(engine));
  ui.addChild(makeInfoMenu(engine));

  connectEngineEvents(engine, ui);
  connectBrowserEvents(engine, ui);

});
