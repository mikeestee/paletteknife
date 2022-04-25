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
  return node.findChild((node: SceneNode): boolean => {
    return node.name === name && node.type == type;
  });
};

// Converts a color string, either #RRGGBB, #RRGGBBAA, #RGB, RGB() or RGBA() format
// into an RGB or RGBA color object.
const hexCodeToRGBA = (colorString: string): RGB | RGBA => {
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
        const rgba = hexCodeToRGBA(colorValue) as RGBA;
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

// Runs this code if the plugin is run in Figma
if (figma.editorType === "figma") {
  let loading = false;

  // This shows the HTML page in "ui.html".
  const options: ShowUIOptions = {
    width: 600,
    height: 400,
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

      // find 'PaintChip' component
      const paintChip: ComponentNode = findChild(
        figma.currentPage,
        "PaintChip",
        "COMPONENT"
      ) as ComponentNode;
      if (paintChip && msg.colors) {
        // make sure the 'PaintChip' is set up properly before we create any
        const hasColor = findChild(paintChip, "Color", "RECTANGLE");
        const hasName = findChild(paintChip, "Name", "TEXT") as TextNode;

        // load the fonts for the nameChip
        if (hasName && hasColor) {
          // we got far enough to load fonts, we'll close in the callback.
          loading = true;
          Promise.all(
            hasName
              .getRangeAllFontNames(0, hasName.characters.length)
              .map(figma.loadFontAsync)
          )
            .then(() => {
              createPalette(paletteName, paletteColors, paintChip);
              figma.closePlugin();
            })
            .catch((e) => {
              console.log("Failed to create palette", e);
              figma.closePlugin();
            });
        }
      }

      // Make sure to close the plugin when you're done. Otherwise the plugin will
      // keep running, which shows the cancel button at the bottom of the screen.
      if (!loading) figma.closePlugin();
    }
  };

  // If the plugins isn't run in Figma, run this code
} else {
  // This plugin will open a window to prompt the user to enter a number, and
  // it will then create that many shapes and connectors on the screen.

  // This shows the HTML page in "ui.html".
  figma.showUI(__html__);

  // Calls to "parent.postMessage" from within the HTML page will trigger this
  // callback. The callback will be passed the "pluginMessage" property of the
  // posted message.
  figma.ui.onmessage = (msg) => {
    // One way of distinguishing between different types of messages sent from
    // your HTML page is to use an object with a "type" property like this.
    if (msg.type === "create-shapes") {
      const numberOfShapes = msg.count;
      const nodes: SceneNode[] = [];
      for (let i = 0; i < numberOfShapes; i++) {
        const shape = figma.createShapeWithText();
        // You can set shapeType to one of: 'SQUARE' | 'ELLIPSE' | 'ROUNDED_RECTANGLE' | 'DIAMOND' | 'TRIANGLE_UP' | 'TRIANGLE_DOWN' | 'PARALLELOGRAM_RIGHT' | 'PARALLELOGRAM_LEFT'
        shape.shapeType = "ROUNDED_RECTANGLE";
        shape.x = i * (shape.width + 200);
        shape.fills = [{ type: "SOLID", color: { r: 1, g: 0.5, b: 0 } }];
        figma.currentPage.appendChild(shape);
        nodes.push(shape);
      }

      for (let i = 0; i < numberOfShapes - 1; i++) {
        const connector = figma.createConnector();
        connector.strokeWeight = 8;

        connector.connectorStart = {
          endpointNodeId: nodes[i].id,
          magnet: "AUTO",
        };

        connector.connectorEnd = {
          endpointNodeId: nodes[i + 1].id,
          magnet: "AUTO",
        };
      }

      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
    }

    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    figma.closePlugin();
  };
}
