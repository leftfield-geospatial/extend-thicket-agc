/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var stepAridAndValleyThicket_ = ee.FeatureCollection("users/dugalh/extend_thicket_agc/step_arid_and_valley_thicket"),
    eeL8SrAgcModel = ee.FeatureCollection("projects/thicket-agc/assets/ee_l8_sr_agc_model_v3"),
    stepAridAndValleyThicket = ee.FeatureCollection("projects/thicket-agc/assets/step_arid_and_valley_thicket");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
/*
    Concept demonstration for extension of local aboveground carbon model to the thicket biome
    Copyright Leftfield Geospatial
    Email: info@leftfield.online

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var cloudMasking = require("users/dugalh/extend_thicket_agc:extend_thicket_agc/cloud_masking.js");
var thicketBoundary = stepAridAndValleyThicket_; // STEP derived thicket boundaries

// obtain Landsat 8 SR image collection of thicket around time of GEF-5 SLM WV3 acquisition
var l8SrImages = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
  .filterMetadata("GEOMETRIC_RMSE_MODEL", "less_than", 10)
  .map(cloudMasking.landsat8SrCloudMask);

var eeAgcModel = eeL8SrAgcModel;
var images = l8SrImages;
var image = images
  .filterBounds(thicketBoundary)
  .filterDate("2017-09-01", "2017-12-30")
  .median(); // composite the image collection
  
var model = {
  m: ee.Number(eeAgcModel.first().get("m")),
  c: ee.Number(eeAgcModel.first().get("c")),
};

// apply EE AGC model to image
function findAgc(image) {
  var rnImage = image.expression("(R / (R + G + B + RE))", {
    R: image.select("SR_B4"),
    G: image.select("SR_B3"),
    B: image.select("SR_B2"),
    RE: image.select("SR_B5"),
  });
  
  return ee.Image(rnImage.log10()
    .multiply(model.m)
    .add(model.c)
    .set("system:time_start", image.get("system:time_start"))
  ).rename("AGC");
}

// Apply the model to find the EE AGC image
var agcImage = findAgc(image).uint8();
var agcMaskedImage = agcImage.clipToCollection(thicketBoundary);

// Create the map panel with AGC overlay
var mapPanel = ui.Map();
mapPanel.setControlVisibility({
  all: false,
  zoomControl: true,
  mapTypeControl: true,
});
mapPanel.setOptions("HYBRID");
mapPanel.centerObject(thicketBoundary);

var vis = {
  min: 0,
  max: 50,
  palette: "red,yellow,green",
  opacity: 1.0,
};
mapPanel.addLayer(agcMaskedImage, vis, "AGC");

// Create side tool panel
// title and description
var titleLabel = ui.Label("Thicket Aboveground Carbon (AGC)", {
  fontWeight: "bold",
  fontSize: "24px",
  color: "SteelBlue",
});
var summaryLabel = ui.Label(
  "Concept demonstration of extended AGC mapping in thicket",
  { fontSize: "14px" }
);
var detailLabel = ui.Label(
  "A localised AGC model is calibrated to coarser resolution Landsat 8 imagery and applied to the biome.",
  { fontSize: "11px" }
);
var noteLabel = ui.Label(
  "Note that AGC accuracy outside the localised model study area has not been established.",
  { fontSize: "11px" }
);
var linkLabel = ui.Label(
  "See the GitHub repository for more information.",
  { fontSize: "11px" },
  "https://github.com/leftfield-geospatial/extend-thicket-agc"
);

var toolPanel = ui.Panel({
  widgets: [titleLabel, summaryLabel, detailLabel, noteLabel, linkLabel],
  layout: ui.Panel.Layout.Flow("vertical"),
  style: { width: "20%" },
});

// legend and its controls
var legendTitleLabel = ui.Label("Legend", {
  fontWeight: "bold",
  fontSize: "20px",
  color: "SteelBlue",
});
toolPanel.add(legendTitleLabel);

var legendDetailLabel = ui.Label("AGC (tC/ha)", {
  fontWeight: "bold",
  fontSize: "14px",
  color: "black",
});

var legendCheckbox = ui.Checkbox({
  label: null,
  value: true,
  onChange: function (value) {
    mapPanel.layers().get(0).setShown(value);
  },
});

var legendOpacitySlider = ui.Slider({
  min: 0,
  max: 1,
  value: 1,
  step: 0.01,
});

legendOpacitySlider.onSlide(function (value) {
  mapPanel.layers().forEach(function (element, index) {
    element.setOpacity(value);
  });
});

var legendHeaderPanel = ui.Panel(
  [legendCheckbox, legendDetailLabel, legendOpacitySlider],
  ui.Panel.Layout.Flow("horizontal")
);
toolPanel.add(legendHeaderPanel);
legendOpacitySlider.setValue(0.6, true);

function makeColourBarParams(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: "100x10",
    format: "png",
    min: 0,
    max: 1,
    palette: palette,
  };
}

var colourBarThumbnail = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColourBarParams(vis.palette),
  style: { stretch: "horizontal", margin: "0px 8px", maxHeight: "24px" },
});

// value labels for colour bar
var legendValuesPanel = ui.Panel({
  widgets: [
    ui.Label(vis.min, { margin: "4px 8px" }),
    ui.Label(vis.max / 2, {
      margin: "4px 8px",
      textAlign: "center",
      stretch: "horizontal",
    }),
    ui.Label(vis.max, { margin: "4px 8px" }),
  ],
  layout: ui.Panel.Layout.flow("horizontal"),
});

toolPanel.add(colourBarThumbnail);
toolPanel.add(legendValuesPanel);

// make credits panel
var creditsTitleLabel = ui.Label("Acknowledgements", {
  fontWeight: "bold",
  fontSize: "20px",
  color: "SteelBlue",
});

var stepDescrLabel = ui.Label(
  "Thicket boundaries derived from the",
  { fontSize: "11px", margin: "4px 4px 4px 8px" }
);
var stepLinkLabel = ui.Label(
  "STEP vegetation map",  
  { fontSize: "11px", margin: "4px 0px" },
  "https://bgis.sanbi.org/STEP/project.asp"
);
var stepPanel = ui.Panel(
  [stepDescrLabel, stepLinkLabel],
  ui.Panel.Layout.Flow("horizontal")
);

var gefDescrLabel = ui.Label(
  "Localised AGC model produced as part of the",  
  { fontSize: "11px", margin: "4px 4px 4px 8px" }
);
var gefLinkLabel = ui.Label(
  "GEF-5 SLM project",
  { fontSize: "11px", margin: "4px 0px" },
  "https://github.com/leftfield-geospatial/map-thicket-agc"
);
var gefPanel = ui.Panel(
  [gefDescrLabel, gefLinkLabel],
  ui.Panel.Layout.Flow("horizontal")
);

var creditsPanel = ui.Panel(
  [creditsTitleLabel, stepPanel, gefPanel],
  ui.Panel.Layout.Flow("vertical")
);
toolPanel.add(creditsPanel);

// add map and tool panels to ui
ui.root.clear();
ui.root.add(ui.SplitPanel(toolPanel, mapPanel));
