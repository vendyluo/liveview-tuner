import {expect, test} from "@playwright/test";

async function load(page) {
  await page.goto("/");
  await page.waitForSelector("liveview-tuner");
}

test("ignores an unrelated 10k-row mutation batch", async ({page}) => {
  await load(page);
  const result = await page.evaluate(async () => {
    const target = document.createElement("div");
    target.id = "tracked-target";
    document.body.append(target);
    const tuner = document.querySelector("liveview-tuner");
    tuner.selectElement(target);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = {...tuner.diagnostics};

    const rows = document.createElement("section");
    rows.id = "large-stream";
    rows.innerHTML = "<p>row</p>".repeat(10_000);
    document.body.append(rows);
    await new Promise((resolve) => setTimeout(resolve, 0));

    return {
      rows: rows.children.length,
      schedules: tuner.diagnostics.syncSchedules - before.syncSchedules,
      runs: tuner.diagnostics.syncRuns - before.syncRuns,
    };
  });

  expect(result).toEqual({rows: 10_000, schedules: 0, runs: 0});
});

test("coalesces repeated tracked mutations into one preview sync", async ({page}) => {
  await load(page);
  const result = await page.evaluate(async () => {
    const target = document.createElement("div");
    target.id = "tracked-target";
    document.body.append(target);
    const tuner = document.querySelector("liveview-tuner");
    tuner.selectElement(target);
    tuner.applyStyleValue(target, "width", "120px");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = {...tuner.diagnostics};

    target.style.width = "200px";
    target.style.width = "220px";
    target.style.width = "240px";
    await new Promise((resolve) => setTimeout(resolve, 0));

    return {
      schedules: tuner.diagnostics.syncSchedules - before.syncSchedules,
      runs: tuner.diagnostics.syncRuns - before.syncRuns,
      preview: target.style.width,
    };
  });

  expect(result).toEqual({schedules: 1, runs: 1, preview: "120px"});
});

test("coalesces outline updates and reuses Similar outline nodes", async ({page}) => {
  await load(page);
  const result = await page.evaluate(async () => {
    const host = document.createElement("section");
    host.innerHTML = '<p class="same">A</p><p class="same">B</p><p class="same">C</p>';
    document.body.append(host);
    const tuner = document.querySelector("liveview-tuner");
    tuner.selectElement(host.firstElementChild);
    tuner.enableSimilar();
    tuner.render();
    const outlines = [...tuner.shadowRoot.querySelectorAll(".similar-outline")];
    const before = {...tuner.diagnostics};

    for (let index = 0; index < 20; index += 1) tuner.scheduleOutlineUpdate();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const afterOutlines = [...tuner.shadowRoot.querySelectorAll(".similar-outline")];

    return {
      runs: tuner.diagnostics.outlineRuns - before.outlineRuns,
      creations: tuner.diagnostics.outlineNodeCreations - before.outlineNodeCreations,
      reused: outlines.length === afterOutlines.length && outlines.every((outline, index) => outline === afterOutlines[index]),
    };
  });

  expect(result).toEqual({runs: 1, creations: 0, reused: true});
});
