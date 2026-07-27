import {expect, test} from "@playwright/test";

async function fixture(page) {
  await page.goto("/");
  await page.waitForSelector("liveview-tuner");
  await page.evaluate(() => {
    const host = document.createElement("section");
    host.id = "test-fixture";
    host.innerHTML = `
      <p class="probe same">A</p>
      <p class="probe same">B</p>
      <p class="probe other">C</p>
    `;
    document.body.append(host);
    const tuner = document.querySelector("liveview-tuner");
    tuner.selectElement(host.children[0]);
  });
}

test.beforeEach(async ({page}) => {
  await fixture(page);
});

test("freezes Similar members until the mode is restarted", async ({page}) => {
  const result = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const [a, b, c] = document.querySelector("#test-fixture").children;

    tuner.enableSimilar();
    const firstSession = tuner.similarSession.id;
    tuner.applyStyleValue(a, "width", "100px");

    b.className = "probe changed";
    c.className = "probe same";
    tuner.applyStyleValue(a, "width", "120px");
    const frozenValues = [a.style.width, b.style.width, c.style.width];

    tuner.disableSimilar();
    tuner.enableSimilar();
    const secondSession = tuner.similarSession.id;
    tuner.applyStyleValue(a, "width", "140px");

    return {
      firstSession,
      secondSession,
      frozenValues,
      restartedValues: [a.style.width, b.style.width, c.style.width],
      groups: tuner.logicalChanges().map(({members, change}) => ({
        members: members.map((member) => member.element.textContent),
        value: change.value,
      })),
    };
  });

  expect(result.frozenValues).toEqual(["120px", "120px", ""]);
  expect(result.secondSession).toBeGreaterThan(result.firstSession);
  expect(result.restartedValues).toEqual(["140px", "120px", "140px"]);
  expect(result.groups).toEqual(expect.arrayContaining([
    {members: ["A", "C"], value: "140px"},
    {members: ["B"], value: "120px"},
  ]));
});

for (const [count, expectedTargets, capped] of [[24, 24, false], [25, 25, false], [26, 25, true], [100, 25, true]]) {
  test(`reports the Similar cap for ${count} matches`, async ({page}) => {
    const result = await page.evaluate(({count}) => {
      const host = document.querySelector("#test-fixture");
      host.innerHTML = Array.from({length: count}, (_, index) => `<p class="probe same">${index}</p>`).join("");
      const tuner = document.querySelector("liveview-tuner");
      tuner.selectElement(host.firstElementChild);
      tuner.enableSimilar();
      tuner.render();
      return {
        targets: tuner.similarSession.targets.length,
        capped: tuner.similarSession.capped,
        label: tuner.shadowRoot.querySelector('[data-action="similar"]').textContent.trim(),
      };
    }, {count});

    expect(result).toEqual({
      targets: expectedTargets,
      capped,
      label: `Similar ${expectedTargets}${capped ? "+" : ""}`,
    });
  });
}

test("removes no-op style changes and temporary inline declarations", async ({page}) => {
  const result = await page.evaluate(async () => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#test-fixture").children[0];
    const original = getComputedStyle(element).width;
    tuner.applyStyleValue(element, "width", "123px");
    tuner.applyStyleValue(element, "width", original);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {inline: element.style.width, styleAttribute: element.getAttribute("style"), changes: tuner.changes.length};
  });

  expect(result).toEqual({inline: "", styleAttribute: null, changes: 0});
});

test("Revert restores the original style attribute state", async ({page}) => {
  const result = await page.evaluate(async () => {
    const tuner = document.querySelector("liveview-tuner");
    const [withoutStyle, withEmptyStyle] = document.querySelector("#test-fixture").children;
    withEmptyStyle.setAttribute("style", "");

    tuner.applyStyleValue(withoutStyle, "width", "123px");
    tuner.applyStyleValue(withoutStyle, "margin-top", "12px");
    tuner.applyStyleValue(withEmptyStyle, "width", "123px");
    tuner.revertAll();
    await new Promise((resolve) => setTimeout(resolve, 0));

    return {
      withoutStyle: withoutStyle.getAttribute("style"),
      withEmptyStyle: withEmptyStyle.getAttribute("style"),
    };
  });

  expect(result).toEqual({withoutStyle: null, withEmptyStyle: ""});
});

test("maps spacing sides, links their edits, and highlights the target edge", async ({page}) => {
  const result = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#test-fixture").children[0];
    const paddingSection = tuner.shadowRoot.querySelector('[data-spacing-section="padding"]');
    const separateControls = paddingSection.querySelectorAll(".spacing-map input[data-property]").length;

    paddingSection.querySelector('[data-link-group="padding"][data-link-mode="true"]').click();
    const linkedSection = tuner.shadowRoot.querySelector('[data-spacing-section="padding"]');
    const linkedControl = linkedSection.querySelector('[data-control-property="padding-top"]');
    const linkedControls = linkedSection.querySelectorAll("input[data-property]").length;
    linkedControl.dispatchEvent(new PointerEvent("pointerenter"));
    const highlight = tuner.shadowRoot.querySelector(".spacing-edge-highlight");
    const linkedHighlight = {
      display: highlight.style.display,
      all: highlight.dataset.all,
      width: highlight.style.width,
    };

    linkedControl.querySelector('button[data-step="1"]').click();
    const refreshedSection = tuner.shadowRoot.querySelector('[data-spacing-section="padding"]');
    refreshedSection.querySelector('[data-link-group="padding"][data-link-mode="false"]').click();
    const rightControl = tuner.shadowRoot.querySelector('[data-control-property="padding-right"]');
    rightControl.dispatchEvent(new PointerEvent("pointerenter"));
    const edgeHighlight = tuner.shadowRoot.querySelector(".spacing-edge-highlight");
    const separateHighlight = {
      all: edgeHighlight.dataset.all,
      width: edgeHighlight.style.width,
      height: edgeHighlight.style.height,
    };
    return {
      separateControls,
      linkedControls,
      separateControlsAfterToggle: tuner.shadowRoot.querySelectorAll('[data-spacing-section="padding"] input[data-property]').length,
      linkedHighlight,
      separateHighlight,
      targetWidth: `${element.getBoundingClientRect().width}px`,
      targetHeight: `${element.getBoundingClientRect().height}px`,
      paddings: ["Top", "Right", "Bottom", "Left"].map((side) => element.style[`padding${side}`]),
    };
  });

  expect(result).toEqual({
    separateControls: 4,
    linkedControls: 1,
    separateControlsAfterToggle: 4,
    linkedHighlight: {display: "block", all: "true", width: result.targetWidth},
    separateHighlight: {all: "false", width: "3px", height: result.targetHeight},
    targetWidth: result.targetWidth,
    targetHeight: result.targetHeight,
    paddings: ["1px", "1px", "1px", "1px"],
  });
});

test("keeps numeric controls on stable alignment and width rules", async ({page}) => {
  const desktop = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const rect = (property) => tuner.shadowRoot.querySelector(`[data-control-property="${property}"]`).getBoundingClientRect();
    const center = (box, axis) => axis === "x" ? box.x + box.width / 2 : box.y + box.height / 2;
    const stepperGeometry = (property) => {
      const stepper = tuner.shadowRoot.querySelector(`[data-control-property="${property}"] .stepper`);
      const [decrease, input, increase] = stepper.children;
      const stepperRect = stepper.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      return {
        buttonWidths: [decrease, increase].map((button) => button.getBoundingClientRect().width),
        centerError: Math.abs(center(stepperRect, "x") - center(inputRect, "x")),
      };
    };
    const sideRects = ["top", "right", "bottom", "left"].map((side) => rect(`padding-${side}`));
    const contentRect = tuner.shadowRoot.querySelector('[data-spacing-section="padding"] .spacing-center').getBoundingClientRect();
    const widthRect = rect("width");
    const heightRect = rect("height");
    const gapRect = rect("gap");
    const modeButtons = [...tuner.shadowRoot.querySelectorAll('[data-spacing-section="padding"] .spacing-mode button')];
    const spacingModeRect = modeButtons[0].parentElement.getBoundingClientRect();
    const spacingUnitRect = tuner.shadowRoot.querySelector('[data-spacing-section="padding"] .section-unit').getBoundingClientRect();
    const regularStepper = stepperGeometry("width");
    const spacingStepper = stepperGeometry("padding-top");

    const representativeValues = ["0", "16", "-12", "999", "999.5"];
    const representativeInputs = ["width", "height", "gap", "padding-top", "margin-left"].map((property) =>
      tuner.shadowRoot.querySelector(`[data-control-property="${property}"] input`)
    );
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const valuesFit = representativeInputs.every((input, index) => {
      input.value = representativeValues[index];
      const style = getComputedStyle(input);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return context.measureText(input.value).width + 4 <= input.clientWidth;
    });

    tuner.shadowRoot.querySelector('[data-tab="type"]').click();
    const metricWidths = ["font-size", "line-height", "letter-spacing"].map((property) => Math.round(rect(property).width));
    tuner.shadowRoot.querySelector('[data-tab="surface"]').click();
    const surfaceWidths = ["border-radius", "border-width", "backdrop-filter", "opacity"].map((property) => Math.round(rect(property).width));

    return {
      sideWidths: sideRects.map((box) => Math.round(box.width)),
      axisErrors: [
        Math.abs(center(sideRects[0], "x") - center(contentRect, "x")),
        Math.abs(center(sideRects[2], "x") - center(contentRect, "x")),
        Math.abs(center(sideRects[3], "y") - center(contentRect, "y")),
        Math.abs(center(sideRects[1], "y") - center(contentRect, "y")),
      ],
      layoutWidths: [widthRect, heightRect, gapRect].map((box) => Math.round(box.width)),
      metricWidths,
      surfaceWidths,
      modeLabels: modeButtons.map((button) => button.textContent.trim()),
      activeMode: modeButtons.find((button) => button.getAttribute("aria-pressed") === "true")?.textContent.trim(),
      regularStepper,
      spacingStepper,
      unitCenterError: Math.abs(center(spacingModeRect, "y") - center(spacingUnitRect, "y")),
      valuesFit,
    };
  });

  expect(new Set(desktop.sideWidths)).toEqual(new Set([100]));
  expect(desktop.axisErrors.every((error) => error <= 0.5)).toBe(true);
  expect(new Set(desktop.layoutWidths).size).toBe(1);
  expect(new Set(desktop.metricWidths).size).toBe(1);
  expect(new Set(desktop.surfaceWidths).size).toBe(1);
  expect(desktop.modeLabels).toEqual(["Linked", "Separate"]);
  expect(desktop.activeMode).toBe("Separate");
  expect(new Set(desktop.regularStepper.buttonWidths).size).toBe(1);
  expect(new Set(desktop.spacingStepper.buttonWidths).size).toBe(1);
  expect(desktop.regularStepper.centerError).toBeLessThanOrEqual(0.5);
  expect(desktop.spacingStepper.centerError).toBeLessThanOrEqual(0.5);
  expect(desktop.unitCenterError).toBeLessThanOrEqual(0.5);
  expect(desktop.valuesFit).toBe(true);

  await page.setViewportSize({width: 390, height: 844});
  const narrow = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    tuner.shadowRoot.querySelector('[data-tab="layout"]').click();
    const section = tuner.shadowRoot.querySelector('[data-spacing-section="padding"]');
    const sectionRect = section.getBoundingClientRect();
    const controls = [...section.querySelectorAll(".spacing-map .numeric-control")].map((control) => control.getBoundingClientRect());
    return {
      widths: controls.map((box) => Math.round(box.width)),
      contained: controls.every((box) => box.left >= sectionRect.left && box.right <= sectionRect.right),
      panelContained: tuner.shadowRoot.querySelector(".panel").getBoundingClientRect().right <= innerWidth,
    };
  });

  expect(new Set(narrow.widths).size).toBe(1);
  expect(narrow.contained).toBe(true);
  expect(narrow.panelContained).toBe(true);
});

test("steps through Tailwind tokens and clears stale suggestions", async ({page}) => {
  const result = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#test-fixture").children[0];
    element.style.paddingTop = "12px";
    tuner.tailwindEnabled = true;
    tuner.render();

    const input = tuner.shadowRoot.querySelector('input[data-property="padding-top"]');
    input.parentElement.querySelector('button[data-step="1"]').click();
    const afterStep = element.style.paddingTop;

    tuner.tailwindEnabled = false;
    tuner.applyStyleValue(element, "padding-top", "13px");
    const change = tuner.changes.find((entry) => entry.property === "padding-top");
    return {afterStep, value: change.value, tailwind: change.tailwind ?? null};
  });

  expect(result).toEqual({afterStep: "14px", value: "13px", tailwind: null});
});

test("previews and cancels a scrub across the frozen Similar group", async ({page}) => {
  await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const [a] = document.querySelector("#test-fixture").children;
    tuner.enableSimilar();
    tuner.applyStyleValue(a, "width", "100px");
  });

  const input = page.locator('liveview-tuner input[data-property="width"]');
  const box = await input.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
  await page.waitForTimeout(20);

  await expect.poll(() => page.evaluate(() =>
    [...document.querySelector("#test-fixture").children].slice(0, 2).map((element) => element.style.width)
  )).toEqual(["120px", "120px"]);

  await page.evaluate(() => document.querySelector("liveview-tuner").styleInteraction.cancel());
  await page.mouse.up();

  const cancelled = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const values = [...document.querySelector("#test-fixture").children].slice(0, 2).map((element) => element.style.width);
    return {
      values,
      input: tuner.shadowRoot.querySelector('input[data-property="width"]').value,
      active: Boolean(tuner.styleInteraction),
    };
  });

  expect(cancelled).toEqual({values: ["100px", "100px"], input: "100", active: false});
});

test("supports precise and accelerated numeric steps", async ({page}) => {
  await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#test-fixture").children[0];
    tuner.applyStyleValue(element, "width", "100px");
  });

  const increase = page.locator('liveview-tuner [data-control-property="width"] button[data-step="1"]');
  await increase.click();
  await increase.click({modifiers: ["Shift"]});
  await increase.click({modifiers: ["Alt"]});

  const width = await page.evaluate(() => document.querySelector("#test-fixture").children[0].style.width);
  expect(width).toBe("111.1px");

  await page.locator('liveview-tuner [data-tab="surface"]').click();
  const opacityIncrease = page.locator('liveview-tuner [data-control-property="opacity"] button[data-step="1"]');
  await page.evaluate(() => document.querySelector("#test-fixture").children[0].style.opacity = "0.5");
  await opacityIncrease.click();
  await expect.poll(() => page.evaluate(() => document.querySelector("#test-fixture").children[0].style.opacity)).toBe("0.55");
  await opacityIncrease.click({modifiers: ["Alt"]});
  await expect.poll(() => page.evaluate(() => document.querySelector("#test-fixture").children[0].style.opacity)).toBe("0.555");
});

test("scrubs from the label and lets Escape cancel the gesture", async ({page}) => {
  const startWidth = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#test-fixture").children[0];
    return tuner.numericStyle(element, "width");
  });

  const label = page.locator('liveview-tuner label[for="control-width"]');
  let box = await label.boundingBox();
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => document.querySelector("#test-fixture").children[0].style.width)).toBe(`${startWidth + 1}px`);
  await page.keyboard.press("Escape");
  await page.keyboard.up("Alt");
  await page.mouse.up();

  const cancelled = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    return {
      width: document.querySelector("#test-fixture").children[0].style.width,
      styleAttribute: document.querySelector("#test-fixture").children[0].getAttribute("style"),
      active: Boolean(tuner.styleInteraction),
      selected: Boolean(tuner.selectedElement),
    };
  });
  expect(cancelled).toEqual({width: "", styleAttribute: null, active: false, selected: true});

  box = await label.boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2);
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect.poll(() => page.evaluate(() => document.querySelector("#test-fixture").children[0].style.width)).toBe(`${startWidth + 50}px`);
});

test("accelerates a held step button and commits once on release", async ({page}) => {
  const startWidth = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#test-fixture").children[0];
    return tuner.numericStyle(element, "width");
  });

  const increase = page.locator('liveview-tuner [data-control-property="width"] button[data-step="1"]');
  const box = await increase.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);

  const preview = await page.evaluate(() => Number.parseFloat(document.querySelector("#test-fixture").children[0].style.width));
  expect(preview).toBeGreaterThanOrEqual(startWidth + 3);
  await page.mouse.up();

  const committed = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const change = tuner.changes.find((entry) => entry.property === "width");
    return {
      width: document.querySelector("#test-fixture").children[0].style.width,
      active: Boolean(tuner.styleInteraction),
      value: change.value,
    };
  });
  expect(committed).toEqual({width: `${preview}px`, active: false, value: `${preview}px`});

  const restoredStyle = await page.evaluate(async () => {
    const tuner = document.querySelector("liveview-tuner");
    tuner.revertAll();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return document.querySelector("#test-fixture").children[0].getAttribute("style");
  });
  expect(restoredStyle).toBeNull();
});

test("commits a repeated scrub without observer rebound", async ({page}) => {
  await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const [a] = document.querySelector("#test-fixture").children;
    tuner.enableSimilar();
    tuner.applyStyleValue(a, "width", "100px");
  });

  const input = page.locator('liveview-tuner input[data-property="width"]');
  const box = await input.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
  await page.waitForTimeout(20);
  await page.mouse.up();

  const result = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const values = [...document.querySelector("#test-fixture").children].slice(0, 2).map((element) => element.style.width);
    const group = tuner.logicalChanges().find(({change}) => change.property === "width");
    return {values, members: group.members.length, value: group.change.value};
  });

  expect(result).toEqual({values: ["120px", "120px"], members: 2, value: "120px"});
});

test("preserves panel scroll and control focus across a render", async ({page}) => {
  const before = await page.evaluate(async () => {
    const tuner = document.querySelector("liveview-tuner");
    const scroll = tuner.shadowRoot.querySelector(".panel-scroll");
    scroll.scrollTop = scroll.scrollHeight;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const scrollRect = scroll.getBoundingClientRect();
    const button = [...tuner.shadowRoot.querySelectorAll("button[data-step]")].find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.top >= scrollRect.top && rect.bottom <= scrollRect.bottom;
    });
    button.focus({preventScroll: true});
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {scrollTop: scroll.scrollTop, step: button.dataset.step, property: button.parentElement.querySelector("input").dataset.property};
  });

  await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    tuner.shadowRoot.activeElement.click();
  });

  const after = await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const tuner = document.querySelector("liveview-tuner");
    return {
      scrollTop: tuner.shadowRoot.querySelector(".panel-scroll").scrollTop,
      step: tuner.shadowRoot.activeElement?.dataset.step,
      property: tuner.shadowRoot.activeElement?.parentElement.querySelector("input")?.dataset.property,
    };
  });

  expect(before.scrollTop).toBeGreaterThan(0);
  expect(after.scrollTop).toBe(before.scrollTop);
  expect(after.step).toBe(before.step);
  expect(after.property).toBe(before.property);
});
