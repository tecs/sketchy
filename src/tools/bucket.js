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
  const {
    editor: { selection },
    input,
    scene,
    tools,
    history,
    emit,
    on,
  } = engine;

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

  /**
   * @param {PlainVec3} newColor
   */
  const setColor = (newColor) => {
    lastColor = newColor;
    engine.emit('contextactions', regenerateActions());
  };

  /**
   * @param {PlainVec3 | ReadonlyVec3} newColor
   */
  const addColor = (newColor) => {
    newColor = /** @type {PlainVec3} */ ([...newColor]);
    if (lastColors.every(color => !colorEquals(color, newColor))) {
      lastColors.unshift(newColor);
      lastColors.pop();
    }
    setColor(newColor);
  };

  /**
   * @returns {import("../engine/tools.js").Action[]}
   */
  const regenerateActions = () => lastColors.map((value, i) => {
    /** @type {PlainVec3} */
    const invertedColor = value[0] + value[1] + value[2] < 360 ? [255, 255, 255] : [0, 0, 0];

    const icon = input.ctrl ? '🌢' : '🪣';

    return {
      name: i ? `Preset color ${i}` : 'Pick color',
      icon: i ? '' : icon,
      style: {
        backgroundColor: Properties.stringifyColor(value),
        color: Properties.stringifyColor(invertedColor),
        border: `2px dashed ${Properties.stringifyColor(colorEquals(value, lastColor) ? invertedColor : value)}`,
      },
      call: () => {
        if (i > 0) {
          setColor(value);
          return;
        }
        emit('propertyrequest', { type: 'color', value }, addColor);
      },
    };
  });

  /** @type {BaseTool} */
  const bucket = {
    type: 'bucket',
    name: 'Bucket',
    shortcut: 'b',
    icon: '🪣',
    cursor: 'bucket',
    start() {
      const { currentStep, enteredInstance, hoveredFaceId, globallyHovered } = scene;

      if (input.ctrl && globallyHovered?.sub?.type === 'face') {
        addColor(globallyHovered.sub.model.data.faces[globallyHovered.sub.id - 1].color);
        return;
      }

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

  on('toolchange', (current, previous) => {
    if (current === bucket) engine.emit('contextactions', regenerateActions());
    else if (previous === bucket) engine.emit('contextactions', null);
  });

  on('keydown', (key) => {
    if (key === 'ctrl' && tools.selected === bucket) {
      engine.emit('cursorchange', 'eyedropper');
      engine.emit('contextactions', regenerateActions());
    }
  });

  on('keyup', (key) => {
    if (key === 'ctrl' && tools.selected === bucket) {
      engine.emit('cursorchange', bucket.cursor);
      engine.emit('contextactions', regenerateActions());
    }
  });

  on('stepchange', (current, previous) => {
    if (current !== scene.currentStep) return;
    if (current && !previous) tools.disable(bucket);
    else if (!current && previous) tools.enable(bucket);
  });

  return bucket;
};
