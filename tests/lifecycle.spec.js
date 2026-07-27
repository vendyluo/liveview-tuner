import {expect, test} from "@playwright/test";

async function fixture(page, markup = '<div id="target">Original</div>') {
  await page.goto("/");
  await page.waitForSelector("liveview-tuner");
  await page.evaluate((html) => {
    const host = document.createElement("section");
    host.id = "lifecycle-fixture";
    host.innerHTML = html;
    document.body.append(host);
    document.querySelector("liveview-tuner").selectElement(host.firstElementChild);
  }, markup);
}

test("reconnects a selected stable-ID element before it has changes", async ({page}) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const tuner = document.querySelector("liveview-tuner");
    const oldElement = document.querySelector("#target");
    const replacement = oldElement.cloneNode(true);
    replacement.textContent = "Server replacement";
    oldElement.replaceWith(replacement);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      connected: tuner.selectedElement.isConnected,
      replacement: tuner.selectedElement === replacement,
      text: tuner.selectedElement.textContent,
    };
  });

  expect(result).toEqual({connected: true, replacement: true, text: "Server replacement"});
});

test("Undo restores the replacement server inline baseline", async ({page}) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const tuner = document.querySelector("liveview-tuner");
    const oldElement = document.querySelector("#target");
    tuner.applyStyleValue(oldElement, "width", "120px");

    const replacement = oldElement.cloneNode(true);
    replacement.style.width = "200px";
    oldElement.replaceWith(replacement);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const preview = replacement.style.width;

    tuner.revertChange(tuner.logicalChanges()[0].key);
    return {preview, restored: replacement.style.width};
  });

  expect(result).toEqual({preview: "120px", restored: "200px"});
});

test("Undo restores an in-place LiveView style baseline", async ({page}) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#target");
    tuner.applyStyleValue(element, "width", "120px");
    element.style.width = "200px";
    await new Promise((resolve) => setTimeout(resolve, 0));
    const preview = element.style.width;
    tuner.revertChange(tuner.logicalChanges()[0].key);
    return {preview, restored: element.style.width};
  });

  expect(result).toEqual({preview: "120px", restored: "200px"});
});

test("commits a text draft onto a replacement and Undo reveals server text", async ({page}) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const tuner = document.querySelector("liveview-tuner");
    const oldElement = document.querySelector("#target");
    tuner.startTextEditing();
    oldElement.textContent = "Draft";

    const replacement = oldElement.cloneNode(false);
    replacement.textContent = "Server text";
    replacement.removeAttribute("contenteditable");
    oldElement.replaceWith(replacement);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const committed = {
      selected: tuner.selectedElement === replacement,
      text: replacement.textContent,
      editing: Boolean(tuner.textEdit),
      contenteditable: replacement.getAttribute("contenteditable"),
    };
    const textChange = tuner.logicalChanges().find(({change}) => change.property === "text-content");
    tuner.revertChange(textChange.key);
    return {...committed, restored: replacement.textContent};
  });

  expect(result).toEqual({
    selected: true,
    text: "Draft",
    editing: false,
    contenteditable: null,
    restored: "Server text",
  });
});

test("uses a supported plain-text editing mode and restores the prior attribute", async ({page}) => {
  await fixture(page, '<button id="target" contenteditable="false">Original</button>');
  const result = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#target");
    tuner.startTextEditing();
    const editingMode = element.getAttribute("contenteditable");
    element.textContent = "Edited";
    tuner.finishTextEditing(true);
    return {
      editingMode,
      restoredAttribute: element.getAttribute("contenteditable"),
      text: element.textContent,
    };
  });

  expect(["plaintext-only", "true"]).toContain(result.editingMode);
  expect(result.restoredAttribute).toBe("false");
  expect(result.text).toBe("Edited");
});

test("destroy is idempotent and reverts previews by default", async ({page}) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#target");
    tuner.applyStyleValue(element, "width", "120px");
    tuner.destroy();
    tuner.destroy();
    return {connected: tuner.isConnected, width: element.style.width};
  });

  expect(result).toEqual({connected: false, width: ""});
});

test("destroy can intentionally preserve committed previews", async ({page}) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const element = document.querySelector("#target");
    tuner.applyStyleValue(element, "width", "120px");
    tuner.destroy({revert: false});
    return {connected: tuner.isConnected, width: element.style.width};
  });

  expect(result).toEqual({connected: false, width: "120px"});
});
