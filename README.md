# LiveView Tuner

LiveView Tuner is a development overlay for adjusting a Phoenix LiveView interface in the browser. Pick an element, preview CSS or text changes, then copy a structured prompt that describes what to implement in the application source.

The tuner does not edit HEEx, CSS, or Tailwind files. Its inline styles and text changes are temporary previews.

## Status

This package is experimental and intended for local development only. Do not include it in a production bundle.

## Install

```sh
npm install --save-dev liveview-tuner
```

Mount it from a development-only entry point. With Vite:

```js
if (import.meta.env.DEV) {
  import("liveview-tuner").then(({mountLiveViewTuner}) => {
    mountLiveViewTuner()
  })
}
```

The package includes its own styles in a Shadow DOM. No CSS import is required.

If you use another bundler, apply its compile-time development guard around the dynamic import. A runtime check alone may leave the tuner in the production bundle.

## Use

1. Start the application in development mode.
2. Open **Tuner** in the bottom-right corner.
3. Pick an element on the page.
4. Adjust its layout, type, or surface properties.
5. Review changes at the bottom of the panel.
6. Choose **Copy edits** and give the copied prompt to your coding agent.
7. After the source change is implemented, choose **Revert all** or reload the page.

The available controls cover display, dimensions, flex layout, spacing, typography, colors, borders, shadows, backdrop blur, and opacity. Numeric controls support buttons, press-and-hold stepping, and drag scrubbing.

### Similar elements

When the selected element has matching siblings, **Similar** applies an edit to a frozen group of matches. The group does not change until Similar mode is restarted. A session includes at most 25 elements; the panel and copied prompt disclose when more matches exist.

### Tailwind suggestions

Enable **Tailwind** before changing a value to snap supported numeric controls to Tailwind v4 tokens and include a utility suggestion in the copied prompt. Suggestions are hints. Check them against the application's theme and source structure before using them.

### Text editing

**Edit text** appears for supported leaf elements. The tuner records the original text so the preview can be undone. It does not support rich-text editing.

## LiveView patches

LiveView may update or replace an element while it is being tuned. The tuner watches selected and changed elements, reapplies active previews after a patch, and updates the Undo baseline to the latest server-rendered state.

Reconnection requires a replacement with the same stable DOM `id` and tag name. Elements without stable IDs become stale when replaced; discard their recorded changes or pick the replacement.

### Optional Phoenix source context

Copy edits can include the HEEx caller, component, slot, and line context emitted by Phoenix LiveView's development annotations. Enable both annotation options in development:

```elixir
# config/dev.exs
config :phoenix_live_view,
  debug_heex_annotations: true,
  debug_attributes: true
```

`debug_heex_annotations` adds caller, component, and slot comments; `debug_attributes` adds `data-phx-loc` line metadata. You may need to run `mix clean` and fully recompile after changing these options.

Source attribution is best-effort and has been tested against LiveView 1.1 and 1.2 debug output, which is not a stable browser-tool protocol. LiveView Tuner still works without either option and simply omits source context when it cannot resolve it safely. Source paths and OTP app names can be copied to the clipboard, so review prompts before sharing them.

## API

```js
import {mountLiveViewTuner} from "liveview-tuner"

const tuner = mountLiveViewTuner()
```

`mountLiveViewTuner()` registers the `<liveview-tuner>` custom element, mounts one instance, and returns it. Repeated calls return the existing instance.

Remove it and restore all previews:

```js
tuner.destroy()
```

To remove the overlay while intentionally keeping its current inline previews:

```js
tuner.destroy({revert: false})
```

`mountLiveViewTuner()` and `destroy()` are the supported public API. Other element methods are implementation details and may change between experimental releases.

## Safety and limitations

- Copied prompts can contain DOM paths, class names, `data-phx-loc`, computed styles, and visible page text. Review them before sharing outside the project.
- Page metadata is treated as untrusted text in the generated prompt, but the prompt still needs human review.
- The picker can enter open Shadow DOM roots. Closed Shadow DOM content is not inspectable.
- Preview state is kept in memory and is lost on reload.
- The tuner does not locate or rewrite source files.
- Visual regression testing and interaction-contract verification remain separate responsibilities.

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

The Playwright suite runs in Chromium, Firefox, and WebKit. Package import and representative Tailwind v4 utilities are also checked.

## License

MIT
