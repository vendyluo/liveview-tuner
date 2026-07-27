import {expect, test} from "@playwright/test";

test("maps supported CSS properties to the Tailwind v4 contract", async ({page}) => {
  await page.goto("/");
  await page.waitForSelector("liveview-tuner");
  const utilities = await page.evaluate(() => {
    const tuner = document.querySelector("liveview-tuner");
    const cases = [
      ["padding-top", "12px"],
      ["margin-top", "-12px"],
      ["width", "13px"],
      ["font-size", "16px"],
      ["font-family", "ui-monospace, monospace"],
      ["font-weight", "600"],
      ["opacity", "0.15"],
      ["border-width", "2px"],
      ["border-radius", "6px"],
      ["backdrop-filter", "blur(12px)"],
      ["background-color", "rgb(255 0 0)"],
      ["color", "rgb(0 0 0)"],
      ["border-color", "rgb(0 0 255)"],
      ["border-style", "dashed"],
      ["box-shadow", "0 8px 24px rgb(0 0 0 / 0.12)"],
      ["line-height", "24px"],
      ["letter-spacing", "-0.25px"],
      ["display", "flex"],
      ["flex-direction", "column"],
      ["align-items", "center"],
      ["justify-content", "space-between"],
      ["text-align", "left"],
    ];
    return Object.fromEntries(cases.map(([property, value]) => [property, tuner.tailwindUtility(property, value)]));
  });

  expect(utilities).toEqual({
    "padding-top": "pt-3",
    "margin-top": "-mt-3",
    width: "w-[13px]",
    "font-size": "text-base",
    "font-family": "font-mono",
    "font-weight": "font-semibold",
    opacity: "opacity-15",
    "border-width": "border-2",
    "border-radius": "rounded-md",
    "backdrop-filter": "backdrop-blur-md",
    "background-color": "bg-[rgb(255_0_0)]",
    color: "text-[rgb(0_0_0)]",
    "border-color": "border-[rgb(0_0_255)]",
    "border-style": "border-dashed",
    "box-shadow": "shadow-[0_8px_24px_rgb(0_0_0_/_0.12)]",
    "line-height": "leading-[24px]",
    "letter-spacing": "tracking-[-0.25px]",
    display: "flex",
    "flex-direction": "flex-col",
    "align-items": "items-center",
    "justify-content": "justify-between",
    "text-align": "text-left",
  });
  expect(Object.values(utilities).every((utility) => utility && !utility.includes("undefined") && !utility.includes("NaN"))).toBe(true);
});
