import { Properties } from "../engine/general/properties.js";

/**
 *
 * @param {PlainVec3} c1
 * @param {PlainVec3} c2
 * @returns {boolean}
 */
const colorEquals = (c1, c2) => c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2];

/** @type {(engine: Engine) => BaseTool} */
export default (engine) => {
  const { editor: { selection }, scene, history, emit, on } = engine;

  /** @type {PlainVec3[]} */
  const lastColors = [
    [255, 255, 255],
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
  ];
  let lastColor = lastColors[0];

  /** @type {BaseTool} */
  const bucket = {
    type: 'bucket',
    name: 'Bucket',
    shortcut: 'b',
    icon: '🪣',
    cursor: 'alias',
    start() {
      const { currentStep, enteredInstance, hoveredFaceId } = scene;
      if (currentStep || !enteredInstance) return;

      const { currentModel } = enteredInstance.body;

      if (!currentModel) return;

      const faceSelection = selection.getByType('face')
        .filter(face => face.instance === enteredInstance)
        .map(({ id }) => id);

      if (!faceSelection.length && hoveredFaceId !== null) faceSelection.push(hoveredFaceId);

      if (!faceSelection.length) return;

      const historyAction = history.createAction(`Fill faces of instance ${enteredInstance.Id.str} with color`, {
        faceIds: faceSelection,
        model: currentModel,
        originalData: currentModel.export(),
        color: lastColor,
      });
      if (!historyAction) return;

      historyAction.append(
        ({ faceIds, model, color }) => {
          const data = model.export();
          for (const id of faceIds) {
            data.faces[id - 1].color = color;
          }
          model.import(data);

          emit('scenechange');
        },
        ({ model, originalData }) => {
          model.import(originalData);
          emit('scenechange');
        },
      );
      historyAction.commit();

    },
    update() {},
    end() {},
    abort() {},
  };

  /**
   * @returns {import("../engine/tools.js").Action[]}
   */
  const regenerateActions = () => lastColors.map((value, i) => {
    /** @type {PlainVec3} */
    const invertedColor = value[0] + value[1] + value[2] < 360 ? [255, 255, 255] : [0, 0, 0];

    return {
      name: i ? `Preset color ${i}` : 'Pick color',
      icon: i ? '' : '🪣',
      style: {
        backgroundColor: Properties.stringifyColor(value),
        color: Properties.stringifyColor(invertedColor),
        border: `2px dashed ${Properties.stringifyColor(colorEquals(value, lastColor) ? invertedColor : value)}`,
      },
      call: () => {
        if (i > 0) {
          lastColor = value;
          engine.emit('contextactions', regenerateActions());
          return;
        }
        emit('propertyrequest', { type: 'color', value }, /** @param {PlainVec3} newColor */ (newColor) => {
          lastColor = newColor;
          if (lastColors.every(color => !colorEquals(color, newColor))) {
            lastColors.unshift(newColor);
            lastColors.pop();
          }

          engine.emit('contextactions', regenerateActions());
        });
      },
    };
  });

  on('toolchange', (current, previous) => {
    if (current === bucket) engine.emit('contextactions', regenerateActions());
    else if (previous === bucket) engine.emit('contextactions', null);
  });

  return bucket;
};
