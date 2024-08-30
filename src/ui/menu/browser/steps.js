/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const tab = tabs.addTab('Steps');

  const render = () => {
    const instance = engine.scene.enteredInstance;
    if (!instance) {
      tab.hide();
      return;
    }
    tab.show(true);
    tab.clearChildren();
    tab.rename(`Steps (${instance.body.name})`);
    const currentStep = instance.body.step;
    for (const step of instance.body.listSteps()) {
      tab.addContainer()
        .addLabel(step.name).$element({
          ondblclick: () => engine.scene.setCurrentStep(step),
          style: { fontWeight: step === engine.scene.currentStep ? 'bold' : undefined },
          className: step !== currentStep ? 'disabled' : undefined,
        });
    }
  };

  render();
  engine.on('currentchange', render);
  engine.on('scenechange', render);
  engine.on('stepchange', render);
};
