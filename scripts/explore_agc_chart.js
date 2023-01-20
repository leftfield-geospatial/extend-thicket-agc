/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var eeL8SrAgcModel = ee.FeatureCollection("projects/thicket-agc/assets/ee_l8_sr_agc_model_v2"),
    stepAridAndValleyThicket = ee.FeatureCollection("projects/thicket-agc/assets/step_arid_and_valley_thicket"),
    gefDegradationStrata = ee.FeatureCollection("projects/thicket-agc/assets/gef_degradation_strata");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
/*
    Concept demonstration for extension of local aboveground carbon model to the thicket biome
    Copyright (C) 2021 Dugal Harris
    Email: dugalh@gmail.com

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
// Initialisation
var cloudMasking = require("users/dugalh/extend_thicket_agc:extend_thicket_agc/cloud_masking.js");
var thicketBoundary = stepAridAndValleyThicket; // STEP derived thicket boundaries
var thicketBounds = stepAridAndValleyThicket.union().geometry().bounds();
var eeAgcModel = eeL8SrAgcModel;
var model = {
  m: ee.Number(eeAgcModel.first().get("m")),
  c: ee.Number(eeAgcModel.first().get("c")),
};

// Landsat 8 SR image collection of thicket for year of GEF-5 SLM WV3 acquisition
var cloudlessColl = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
  .filterMetadata("GEOMETRIC_RMSE_MODEL", "less_than", 10)
  .filterMetadata("CLOUD_COVER_LAND", "less_than",  20)
  .filterBounds(thicketBounds)
  .map(cloudMasking.landsat8SrCloudMask);

function cloudlessComposite(year){
  // return yearly median composite
  return cloudlessColl.filter(ee.Filter.calendarRange(year, year, "year"))
  .filter(ee.Filter.calendarRange(1, 12, "month"))
  .median()
  .set("year", year)
  .set("system:time_start", ee.Date.fromYMD(year, 7, 1));
}

// create a collection of yearly median composites
var years = ee.List.sequence(2014, 2022); // valid L8 years
var yearlyComposites = ee.ImageCollection.fromImages(
  years.map(cloudlessComposite).flatten()
);

// Create the map panel with drawing tools
var mapPanel = ui.Map();
mapPanel.setOptions("HYBRID");
mapPanel.centerObject(thicketBounds);
var tools = mapPanel.drawingTools();
tools.setDrawModes(['point', 'polygon', 'rectangle']);

// Add composite & AGC image layers for 2017
var l8Vis = {
  min: 7500,
  max: 13000,
  gamma: 1.2,
  bands: ["SR_B4", "SR_B3", "SR_B2"],
  opacity: 1.0,
};

var agcVis = {
  min: 0,
  max: 50,
  palette: "red,yellow,green",
  opacity: 1.0,
};

function findAgc(image) {
  // Given an L8 image, return the AGC estimate
  var rnImage = image.expression('(R / (R + G + B + RE))',
    {
      'R': image.select('.*B4$'),
      'G': image.select('.*B3$'),
      'B': image.select('.*B2$'),
      'RE': image.select('.*B5$'),
    });  
  return ee.Image(rnImage.log10()
    .multiply(model.m)
    .add(model.c)
    .set("system:time_start", image.get("system:time_start"))
  ).rename("AGC");
}

function addImageLayers(year){
  // find composite & correponding AGC for a given year and add to map
  var composite = yearlyComposites.filter(ee.Filter.eq("year", year)).first();
  var maskedComposite = composite.clipToCollection(thicketBoundary);
  
  // Apply the model to find the EE AGC image
  var agcImage = findAgc(composite).uint8();
  var maskedAgcImage = agcImage.clipToCollection(thicketBoundary);

  var compositeLayer = ui.Map.Layer(
    maskedComposite, l8Vis, "Composite (" + year + ")", true, 0.6
  );
  var agcLayer = ui.Map.Layer(maskedAgcImage, agcVis, "AGC (" + year + ")", true, 0.6);
  mapPanel.layers().reset([compositeLayer, agcLayer]);
}

addImageLayers(2017);

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
  "https://github.com/dugalh/extend_thicket_agc"
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
toolPanel.add(legendDetailLabel);

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
  params: makeColourBarParams(agcVis.palette),
  style: { stretch: "horizontal", margin: "0px 8px", maxHeight: "24px" },
});

// value labels for colour bar
var legendValuesPanel = ui.Panel({
  widgets: [
    ui.Label(agcVis.min, { margin: "4px 8px" }),
    ui.Label(agcVis.max / 2, {
      margin: "4px 8px",
      textAlign: "center",
      stretch: "horizontal",
    }),
    ui.Label(agcVis.max, { margin: "4px 8px" }),
  ],
  layout: ui.Panel.Layout.flow("horizontal"),
});

toolPanel.add(colourBarThumbnail);
toolPanel.add(legendValuesPanel);

if (true) // create a time series of yearly AGC
{
  
  var agcTimeSeriesChart = function(geom, layer, widget) {
    // show the clicket point
    // var point = ee.Geometry.Point(coords.lon, coords.lat);
    // geom = ee.Geometry(geom);
    var featColl = ee.FeatureCollection([]);
    var layerFeats = [];
    var layerColors = [];
    var aggrLayerGeometries = function(layer){
      var layerGeom = ee.FeatureCollection(layer.getEeObject()).geometry();
      // layerFeatColl = layerFeatColl.set("system:id", layer.getName());
      // featColl = featColl.merge(layerFeatColl);
      layerFeats.push(ee.Feature(layerGeom, {name: layer.getName()}));
      layerColors.push(layer.getColor());
    };
    mapPanel.drawingTools().layers().forEach(aggrLayerGeometries);
    featColl = ee.FeatureCollection(layerFeats);
    print(featColl);
    // geom = featColl.geometry();
    // print(geom);
    // var dot = ui.Map.Layer(geom, { color: "000000" }, "clicked location");
    // mapPanel.layers().set(2, dot);
  
    // find [median(images) for images inbetween Sept and Dec in each year]
  
    // print(yearlyMedianImages.size());
    // print(yearlyMedianImages.first().reduce(ee.Reducer.mean()));
  
    // make a chart of agc(median images)
    var agcChart = ui.Chart.image.seriesByRegion(
      yearlyComposites.map(findAgc),
      layerFeats,
      ee.Reducer.mean(),
      0,
      30,
      "system:time_start",
      "name"
    );
  
    agcChart.setOptions({
      title: "AGC: time series",
      vAxis: { title: "AGC (tC/ha)" },
      hAxis: { title: "Date", format: "MM-yy", gridlines: { count: 7 } },
      colors: layerColors,
      // series: {
      //   0: {
      //     color: "SteelBlue",
      //     lineWidth: 1,
      //     pointsVisible: true,
      //     pointSize: 3,
      //   },
      // },
      legend: { position: "right" },
    });
    
    agcChart.onClick(function(xValue, yValue, seriesName) {
      if (!xValue) return;  // Selection was cleared.
    
      // Show the image for the clicked date.
      var clickYear = ee.Date(xValue).get("year");
      addImageLayers(clickYear);
      // mapPanel.layers().set(2, dot);
    });
    
    toolPanel.widgets().set(10, agcChart);
  
    if (false)    // create a chart of solar zenith and azimuth angle for debugging agc
    {
      var szaCollection = images
        .filter(ee.Filter.calendarRange(9, 12, "month"))
        .map(function (image) {
          return image.addBands([
            image.metadata("SOLAR_ZENITH_ANGLE"),
            image.metadata("SOLAR_AZIMUTH_ANGLE"),
          ]);
        });
      
      var szaChart = ui.Chart.image.series(
        szaCollection.select(["SOLAR_ZENITH_ANGLE", "SOLAR_AZIMUTH_ANGLE"]),
        point,
        ee.Reducer.mean(),
        30
      );
    
      szaChart.setOptions({
        title: "SZA: time series",
        vAxis: { title: "SZA (deg)" },
        hAxis: { title: "Date", format: "MM-yy", gridlines: { count: 7 } },
        series: {
          0: {
            color: "SteelBlue",
            lineWidth: 0,
            pointsVisible: true,
            pointSize: 3,
          },
        },
        legend: { position: "right" },
      });
      toolPanel.widgets().set(11, szaChart);
    }
  };
  // TO DO: onClick should have a wrapper function that makes a point geometry and passes to agcTimeSeriesChart
  // TO DO: debounce all the below
  // mapPanel.onClick(agcTimeSeriesChart);
  // mapPanel.style().set("cursor", "crosshair");


  // test point for AGC chart
  // var initialPoint = ee.Geometry.Point(24.37007063238984017, -33.66776731422557845);   //Baviaanskloof Smitskraal
  var initialPoint = ee.Geometry.Point(23.94436842431511536, -33.55374308591438393); //Baviaanskloof Sewefontein
  // var initialPoint = ee.Geometry.Point(22.21972695106567031, -33.57070965396300011);  // Oudtshoorn Grootkop
  // mapPanel.centerObject(initialPoint, 4);
  
  var chartTitleLabel = ui.Label("Time Series", {
    fontWeight: "bold",
    fontSize: "20px",
    color: "SteelBlue",
  });
  toolPanel.add(chartTitleLabel);
  
  var addInitGeomLayer = function(stratumName, stratumColor){
    var stratumGeom = gefDegradationStrata.filter(ee.Filter.eq("DegrClass", stratumName)).geometry();
    var addInitGeomLayer = function(geom){
      mapPanel.drawingTools().addLayer([geom], "GEF " + stratumName + " stratum", stratumColor);
    };
    // stratumGeom.evaluate(addInitGeomLayer);
    addInitGeomLayer(stratumGeom.getInfo());  // add synchronously so we don't trigger event handlers below
    // stratumGeom.evaluate(addInitGeomLayer);
  };
  var strataDict = {Pristine: "green", Moderate: "orange", Severe: "red"};
  for (var stratumName in strataDict){
    addInitGeomLayer(stratumName, strataDict[stratumName]);
  }
  agcTimeSeriesChart();
  mapPanel.drawingTools().onDraw(agcTimeSeriesChart);
  mapPanel.drawingTools().onEdit(agcTimeSeriesChart);
  mapPanel.drawingTools().onSelect(agcTimeSeriesChart);
  mapPanel.drawingTools().onErase(agcTimeSeriesChart);
  mapPanel.drawingTools().onLayerConfig(agcTimeSeriesChart);
  mapPanel.drawingTools().onLayerRemove(agcTimeSeriesChart);

}

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
  // "https://bgis.sanbi.org/SpatialDataset/Detail/194"
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
  "https://github.com/dugalh/map_thicket_agc"
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
// toolPanel.add(ui.Label('[Chart]'));

// Register a callback on the default map to be invoked when the map is clicked.
// mapPanel.onClick(generateChart);
// Configure the map.
mapPanel.style().set('cursor', 'crosshair');

// add map and tool panels to ui
ui.root.clear();
ui.root.add(ui.SplitPanel(toolPanel, mapPanel));
