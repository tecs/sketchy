import UI from './ui/index.js';
import Engine from './engine/index.js';

import renderAxis from './passes/axis.js';
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

import makeSystemMenu from './ui/menu/system.js';
import makeToolsMenu from './ui/menu/tools.js';
import makeBrowserMenu from './ui/menu/browser.js';
import makeInfoMenu from './ui/menu/info.js';

window.addEventListener('load', () => {
  const ui = new UI(document.body);
  const engine = new Engine(ui.canvas);

  engine.renderer.addToPipeline(renderSkybox);
  engine.renderer.addToPipeline(renderObjects);
  engine.renderer.addToPipeline(renderLines);
  engine.renderer.addToPipeline(renderPoints);
  engine.renderer.addToPipeline(extractId);
  engine.renderer.addToPipeline(extractPosition);
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

  engine.on('usererror', (message) => ui.addDialog(message));
  // eslint-disable-next-line no-console
  engine.on('error', console.error);

  ui.canvas.addEventListener('wheel', ({ deltaY }) => engine.input.scroll(/** @type {-1|1} */ (Math.sign(deltaY))), { passive: true });

  ui.canvas.addEventListener('mousedown', ({ button }) => engine.input.setButton(button, true));
  ui.canvas.addEventListener('mouseup', ({ button }) => engine.input.setButton(button, false));

  ui.canvas.addEventListener('mousemove', (e) => engine.input.setPosition(e.clientX, e.clientY, e.movementX, e.movementY));

  document.addEventListener('keydown', ({ key }) => engine.input.setKey(key, true));
  document.addEventListener('keyup', ({ key }) => engine.input.setKey(key, false));

  window.addEventListener('resize', engine.driver.resize);
  engine.driver.resize();
});
