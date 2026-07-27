import {expect, test} from "@playwright/test";
import {LiveViewTunerElement, mountLiveViewTuner} from "liveview-tuner";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

test("package root is safe to import without browser globals", () => {
  expect(typeof LiveViewTunerElement).toBe("function");
  expect(typeof mountLiveViewTuner).toBe("function");
  expect(() => mountLiveViewTuner()).toThrow("can only be mounted in a browser environment");
});

test("representative Tailwind suggestions compile with Tailwind v4", () => {
  const directory = mkdtempSync(join(tmpdir(), "liveview-tuner-tailwind-"));
  const output = join(directory, "output.css");
  try {
    execFileSync("npx", ["@tailwindcss/cli", "-i", "tests/fixtures/tailwind-input.css", "-o", output, "--minify"], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    const css = readFileSync(output, "utf8");
    expect(css).toContain(".pt-3");
    expect(css).toContain(".opacity-15");
    expect(css).toContain("backdrop-filter");
    expect(css).toContain("box-shadow");
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
