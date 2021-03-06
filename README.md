# PaletteKnife

The Figma plugin allows you to create and update ColorStyle palettes from a JSON description.

To make changes, you will need to first do the [setup instructions](https://www.figma.com/plugin-docs/setup/). If you just want to load the plugin as-is, you can load it from the `Plugins/Development/Import plugin from manifest...` menu

Example Palette:

```json
{
  "name": "test",
  "colors": {
    "blackOverlay": "#0000007f",
    "red": "#FF0000",
    "blue": "#00F",
    "green": "rgb(0,255,0)",
    "whiteOverlay": "rgba(255,255,255,0.5)"
  }
}
```

![Example](./Example.jpg)

Before it can work, you will need to create a Figma Component on the canvas. It should be constructed like so:

- A COMPONENT named "PaletteChip", at the top level of the canvas, containing:
  - A RECTANGLE node with the name "Color"
  - A TEXT node with the name "Name"

The palette generator will create instances of this node. Each instance will be named "paletteName/colorName". The TEXT node will be updated to match, and the color for the RECTANGLE node will be updated to use the matching styleId.

If a style with the matching name already exists, the generator will update the color in that style and re-use the styleId. Existing elements in the canvas that reference that style will update to show the changed color as a consequence.

In this way, you can maintain a set of JSON files, each with a different palette, and update them over time.
