/**
 * PaletteKnife.ts
 * Copyright: Mike Estee 2022
 *
 * A Figma plugin for importing color palettes from JSON.
 */

// Locate a child node by name and type.
const findChild = (
  node: InstanceNode | ComponentNode | PageNode,
  name: string,
  type: string
): SceneNode => {
  // find first instance, recursively
  return node.findOne((node: SceneNode): boolean => {
    return node.name === name && node.type == type;
  });
};

// Converts a color string, either #RRGGBB, #RRGGBBAA, #RGB, RGB() or RGBA() format
// into an RGB or RGBA color object.
const stringToRGBA = (colorString: string): RGB | RGBA => {
  const _rgbRegEx = /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i;
  const _rgbaRegEx =
    /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)\)/i;

  if (colorString.length === 4) {
    if (colorString[0] === "#") {
      return {
        r: parseInt(colorString[1], 16) / 15,
        g: parseInt(colorString[2], 16) / 15,
        b: parseInt(colorString[3], 16) / 15,
      };
    }
  } else if (colorString.length === 7) {
    if (colorString[0] === "#") {
      return {
        r: parseInt(colorString.substr(1, 2), 16) / 255,
        g: parseInt(colorString.substr(3, 2), 16) / 255,
        b: parseInt(colorString.substr(5, 2), 16) / 255,
      };
    }
  } else if (colorString.length === 9) {
    if (colorString[0] === "#") {
      return {
        r: parseInt(colorString.substr(1, 2), 16) / 255,
        g: parseInt(colorString.substr(3, 2), 16) / 255,
        b: parseInt(colorString.substr(5, 2), 16) / 255,
        a: parseInt(colorString.substr(7, 2), 16) / 255,
      };
    }
  } else {
    const rgbMatch = colorString.match(_rgbRegEx);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10) / 255,
        g: parseInt(rgbMatch[2], 10) / 255,
        b: parseInt(rgbMatch[3], 10) / 255,
      };
    } else {
      const rgbaMatch = colorString.match(_rgbaRegEx);
      if (rgbaMatch) {
        return {
          r: parseInt(rgbaMatch[1], 10) / 255,
          g: parseInt(rgbaMatch[2], 10) / 255,
          b: parseInt(rgbaMatch[3], 10) / 255,
          a: parseFloat(rgbaMatch[4]),
        };
      }
    }
  }

  return { r: 0, g: 0, b: 0, a: 0 };
};

const hexToRgba = (hexColor: string): string => {
  const rgba = stringToRGBA(hexColor) as RGBA;

  if (rgba.a != undefined) {
    return (
      "rgba(" +
      Math.round(rgba.r * 255) +
      ", " +
      Math.round(rgba.g * 255) +
      ", " +
      Math.round(rgba.b * 255) +
      ", " +
      rgba.a.toFixed(3) +
      ")"
    );
  } else {
    return (
      "rgb(" +
      Math.round(rgba.r * 255) +
      ", " +
      Math.round(rgba.g * 255) +
      ", " +
      Math.round(rgba.b * 255) +
      ")"
    );
  }
};

// Updates a PaintStyle, or creates a new one if not found, and returns the styleId
const updateStyleAndReturnID = (
  paintStyles: PaintStyle[],
  colorName: string,
  solidPaint: SolidPaint
): string => {
  const foundStyle = paintStyles.find((style: PaintStyle): boolean => {
    return style.name === colorName;
  });
  if (foundStyle) {
    foundStyle.paints = [solidPaint];
    return foundStyle.id;
  } else {
    const newStyle = figma.createPaintStyle();
    newStyle.name = colorName;
    newStyle.paints = [solidPaint];
    return newStyle.id;
  }
};

// Create the palette nodes and update the paint styles
const createPalette = (
  paletteName: string,
  paletteColors: any,
  paintChip: ComponentNode
): void => {
  // if we found the paint chip, create instances for each color
  const nodes: SceneNode[] = [];
  const paintStyles = figma.getLocalPaintStyles();

  // create the frame to hold the chips
  const frame = figma.createFrame();
  const offset = paintChip.height;

  // set the paint color
  let index = 0;
  for (const colorName in paletteColors) {
    if (paletteColors.hasOwnProperty(colorName)) {
      try {
        const fullColorName = `${paletteName}/${colorName}`;

        // parse the color
        const colorValue = paletteColors[colorName] as string;
        const rgba = stringToRGBA(colorValue) as RGBA;
        const colorStyle: SolidPaint = {
          type: "SOLID",
          color: { r: rgba.r, g: rgba.g, b: rgba.b },
          opacity: rgba.a,
        };

        // create the style, if needed, and return the ID
        const fillStyleId = updateStyleAndReturnID(
          paintStyles,
          fullColorName,
          colorStyle
        );

        // for each instance, update the name and color for 'Color' and 'Name'
        const newNode = paintChip.createInstance();
        newNode.y = offset * index;

        // set the color
        const colorNode = findChild(
          newNode,
          "Color",
          "RECTANGLE"
        ) as RectangleNode;
        const nameNode = findChild(newNode, "Name", "TEXT") as TextNode;
        colorNode.fillStyleId = fillStyleId;

        // set the name
        nameNode.characters = fullColorName;
        newNode.name = fullColorName;

        // add to the canvas and list of created nodes
        frame.appendChild(newNode);
        nodes.push(newNode);
        index += 1;
      } catch (e) {
        console.log("Couldn't create palette chip", e);
      }
    }
  }

  // update frame auto layout
  frame.name = paletteName;
  frame.resize(frame.width, offset * (index + 1));
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.verticalPadding = 4.0;
  frame.horizontalPadding = 4.0;
  frame.itemSpacing = 4.0;
  frame.counterAxisSizingMode = "AUTO";
  frame.primaryAxisAlignItems = "MIN";
  frame.counterAxisAlignItems = "MIN";

  // add to canvas
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
};

const multiFontLoader = async (nameNode: TextNode) => {
  return await Promise.all(
    nameNode
      .getRangeAllFontNames(0, nameNode.characters.length)
      .map(figma.loadFontAsync)
  );
};

const createChipComponent = (fontName: FontName) => {
  const chip = figma.createComponent();
  chip.name = "PaintChip";
  chip.resize(128, 32 + 4.0);
  chip.layoutMode = "HORIZONTAL";
  chip.itemSpacing = 4.0;
  chip.counterAxisAlignItems = "CENTER";
  chip.counterAxisSizingMode = "AUTO";
  chip.primaryAxisSizingMode = "AUTO";

  const rect = figma.createRectangle();
  rect.name = "Color";
  rect.resize(64, 32);
  rect.fills = [{ type: "SOLID", color: { r: 1.0, g: 0, b: 0 } }];

  const text = figma.createText();
  text.name = "Name";
  text.resize(64, 32);
  text.x = 64;

  // add to canvas
  chip.appendChild(rect);
  chip.appendChild(text);
  figma.currentPage.appendChild(chip);
  figma.viewport.scrollAndZoomIntoView([chip]);

  // calls that require the font to be loaded
  text.fontName = fontName;
  text.fontSize = 12;
  text.textAutoResize = "WIDTH_AND_HEIGHT";
  text.textAlignVertical = "CENTER";
  text.characters = "palette/color";
};

const singleFontLoader = async (fontName: FontName) => {
  await figma.loadFontAsync(fontName);
};

// Runs this code if the plugin is run in Figma
if (figma.editorType === "figma") {
  let loading = false;

  // This shows the HTML page in "ui.html".
  const options: ShowUIOptions = {
    width: 600,
    height: 440,
  };
  figma.showUI(__html__, options);

  // Calls to "parent.postMessage" from within the HTML page will trigger this
  // callback. The callback will be passed the "pluginMessage" property of the
  // posted message.
  figma.ui.onmessage = (msg) => {
    if (msg.type === "create-palette") {
      // validate that msg contains "name" and "colors"
      const paletteName = msg.colors.name;
      const paletteColors = msg.colors.colors;

      // find 'PaintChip' component, search only top level
      const paintChip = figma.currentPage.findChild(
        (node: SceneNode): boolean => {
          return node.name === "PaintChip" && node.type == "COMPONENT";
        }
      ) as ComponentNode;

      if (paintChip && msg.colors) {
        // make sure the 'PaintChip' is set up properly before we create any
        const hasColor = findChild(paintChip, "Color", "RECTANGLE");
        const hasName = findChild(paintChip, "Name", "TEXT") as TextNode;

        // load the fonts for the nameChip
        if (hasName && hasColor) {
          // we got far enough to load fonts, we'll close in the callback.
          loading = true;
          multiFontLoader(hasName)
            .then(() => {
              createPalette(paletteName, paletteColors, paintChip);
              figma.closePlugin();
            })
            .catch((e) => {
              console.log("Failed to create palette", e);
              figma.closePlugin();
            });
        }
      } else {
        console.log(
          "Unable to find PaintChip component at top-level of current page."
        );
      }
    } else if (msg.type === "create-component") {
      loading = true;
      const fontName = { family: "Helvetica", style: "Regular" };
      singleFontLoader(fontName)
        .then(() => {
          createChipComponent(fontName);
          figma.closePlugin();
        })
        .catch((e) => {
          console.log("Failed to create component", e);
          figma.closePlugin();
        });
    }

    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    if (!loading) figma.closePlugin();
  };
}
