/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var eeL8SrAgcModel = ee.FeatureCollection("projects/thicket-agc/assets/ee_l8_sr_agc_model_v2"),
    eeModisNbarAgcModel = ee.FeatureCollection("projects/thicket-agc/assets/ee_modis_nbar_agc_model_v2"),
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
////////////////////////////////////////////////////////////////////////////
// Initialisation
var cloudMasking = require("users/dugalh/extend_thicket_agc:extend_thicket_agc/cloud_masking.js");
var thicketBoundary = stepAridAndValleyThicket; // STEP derived thicket boundaries
var thicketBounds = stepAridAndValleyThicket.union().geometry().bounds();

function qtrMedianComp(year, quarter, coll){
  // Return a quarterly median composite of srcColl
  if (!coll) coll = srcColl;
  
  return srcColl.filter(ee.Filter.calendarRange(year, year, "year"))
  .filter(ee.Filter.calendarRange((quarter-1)*3+1, (quarter)*3, "month"))
  .mean()
  .set("year", year)
  .set("quarter", quarter)
  .set("system:time_start", ee.Date.fromYMD(year, (quarter-1)*3+2, 15));
}

function qtrMedoidComp(year, quarter, coll){
  // Return an quarterly medoid composite of srcColl
  if (!coll) coll = srcColl;
  var medianComp = qtrMedianComp(year, quarter); 
  
  var medDiff = function(image) {
    // Return the sum of squared differences between image bands and collection median
    var diff = ee.Image(image).subtract(medianComp).pow(ee.Image.constant(2)); 
    return diff.reduce('sum').addBands(image);  
  };
  
  // find the medoid (pixel from image with smallest distance to collection median)
  var medoidComp = srcColl
  .filter(ee.Filter.calendarRange(year, year, "year"))
  .filter(ee.Filter.calendarRange((quarter-1)*3+1, (quarter)*3, "month"))
  .map(medDiff)
  .reduce(ee.Reducer.min(5))
  .select([1, 2, 3, 4], rgbnBands)
  .set("year", year)
  .set("quarter", quarter)
  .set("system:time_start", ee.Date.fromYMD(year, (quarter-1)*3+2, 15));

  return medoidComp;
}


function annualMedianComp(year, coll){
  // Return an annual median composite of srcColl
  if (!coll) coll = srcColl;
  
  return srcColl.filter(ee.Filter.calendarRange(year, year, "year"))
  .filter(ee.Filter.calendarRange(1, 12, "month"))
  .mean()
  .set("year", year)
  .set("system:time_start", ee.Date.fromYMD(year, 7, 1));
}

function annualMedoidComp(year, coll){
  // Return an annual medoid composite of srcColl
  if (!coll) coll = srcColl;
  var medianComp = annualMedianComp(year); 
  
  var medDiff = function(image) {
    // Return the sum of squared differences between image bands and collection median
    var diff = ee.Image(image).subtract(medianComp).pow(ee.Image.constant(2)); 
    return diff.reduce('sum').addBands(image);  
  };

  // find the medoid (pixel from image with smallest distance to collection median)
  var medoidComp = srcColl
  .filter(ee.Filter.calendarRange(year, year, "year"))
  .filter(ee.Filter.calendarRange(1, 12, "month"))
  .map(medDiff)
  .reduce(ee.Reducer.min(5))
  .select([1, 2, 3, 4], rgbnBands)
  .set("year", year)
  .set("system:time_start", ee.Date.fromYMD(year, 7, 1));

  return medoidComp;
}

function range(start, stop, step){
  if (!step) step = 1;
  var size = (stop - start) / step + 1;
  return Array.apply(null, Array(size)).map(function (_, i) {return (i * step) + start;});
}

if (true){
  // Landsat 8
  var rgbnBands = ["SR_B4", "SR_B3", "SR_B2", "SR_B5"];
  // cloud masked RGBN collection
  var srcColl = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterMetadata("GEOMETRIC_RMSE_MODEL", "less_than", 100)
    .filterMetadata("CLOUD_COVER_LAND", "less_than",  10)
    .filterBounds(thicketBounds)
    .map(cloudMasking.landsat8SrCloudMask)
    .select(rgbnBands);

  // create a collection of annual composites
  var years = range(2014, 2022); //ee.List.sequence(2014, 2022); // valid L8 years
  var quarters = range(1, 4); //ee.List.sequence(1, 4); 
  var compList = [];
  for (var yi in years) {
    // var tmpList = [];
    for (var qi in quarters) {
      compList.push(qtrMedoidComp(years[yi], quarters[qi]));
    }
    // compList.push(annualMedianComp(years[yi], ee.ImageCollection(tmpList)));
  }
  var compColl = ee.ImageCollection(compList);
  
  // L8 RGBN visualisation params
  var rgbnVisParams = {
    min: 7500,
    max: 13000,
    gamma: 1.2,
    bands: rgbnBands.slice(0, 3),
    opacity: 1.0,
  };
  var eeAgcModel = eeL8SrAgcModel;
}
else{
  // MODIS NBAR
  var rgbnBands = [
    "Nadir_Reflectance_Band1", 
    "Nadir_Reflectance_Band4", 
    "Nadir_Reflectance_Band3", 
    "Nadir_Reflectance_Band2"
  ];
  // cloud masked RGBN collection
  var srcColl = ee.ImageCollection("MODIS/061/MCD43A4")
    .filterBounds(thicketBounds)
    .select(rgbnBands);

  // create a collection of annual composites
  var years = ee.List.sequence(2001, 2016); 
  var compColl = ee.ImageCollection.fromImages(
    years.map(annualMedoidComp).flatten()
  );
  
  // MODIS RGBN visualisation params
  var rgbnVisParams = {
    min: 500,
    max: 2000,
    gamma: 1.2,
    bands: rgbnBands.slice(0, 3),
    opacity: 1.0,
  };
  
  var eeAgcModel = eeModisNbarAgcModel;
}

var model = {
  m: ee.Number(eeAgcModel.first().get("m")),
  c: ee.Number(eeAgcModel.first().get("c")),
};
print("Model: ", model);

////////////////////////////////////////////////////////////////////////////
// AGC modelling

function findAgc(image) {
  // Given an RGBN image, return the AGC estimate
  var rnImage = image.expression('(R / (R + G + B + NIR))',
    {
      'R': image.select(0),
      'G': image.select(1),
      'B': image.select(2),
      'NIR': image.select(3),
    });  
  return ee.Image(rnImage.log10()
    .multiply(model.m)
    .add(model.c)
    .set("system:time_start", image.get("system:time_start"))
  ).rename("AGC");
}

////////////////////////////////////////////////////////////////////////////
// Visualisation
// TO DO - try retrieve agcVisParams from map and place these vars elsewhere
var agcVisParams = {
  min: 0,
  max: 50,
  palette: "red,yellow,green",
  opacity: 1.0,
};

function createMapPanel(){
  // Create the map panel with drawing tools
  var mapPanel = ui.Map();
  mapPanel.setOptions("HYBRID");
  mapPanel.centerObject(thicketBounds);
  var tools = mapPanel.drawingTools();
  tools.setDrawModes(['point', 'polygon', 'rectangle']);
  mapPanel.style().set('cursor', 'crosshair');
  return mapPanel;
}

function addMapImageLayers(mapPanel, date){
  // Add AGC and RGB composites for year to mapPanel
  // var composite = compColl.filter(ee.Filter.eq("year", year)).first();
  date = ee.Date(date);
  var composite = compColl.filter(ee.Filter.date(date)).first();
  var maskedComposite = composite.clipToCollection(thicketBoundary);
  
  // Apply the model to find the EE AGC image
  var agcImage = findAgc(composite).uint8();
  var maskedAgcImage = agcImage.clipToCollection(thicketBoundary);

  var dateStr = date.format("yyyy-MM-dd").getInfo();
  var compositeLayer = ui.Map.Layer(
    maskedComposite, rgbnVisParams, "RGBN Composite (" + dateStr + ")", true, 0.6
  );
  var agcLayer = ui.Map.Layer(
    maskedAgcImage, agcVisParams, "AGC (" + dateStr + ")", true, 0.6
  );
  mapPanel.layers().reset([compositeLayer, agcLayer]);
}

function initMapDrawingLayers(mapPanel){
  // Add initial geometries to map drawing layers
  
  var addStratumGeom = function(stratumName, stratumColor){
    var stratumGeom = gefDegradationStrata.filter(ee.Filter.eq("DegrClass", stratumName)).geometry();
    // add synchronously so we don't trigger event handlers which are added
    mapPanel.drawingTools().addLayer([stratumGeom.getInfo()], stratumName, stratumColor);
  };
  
  var strataDict = {Pristine: "green", Moderate: "orange", Severe: "red"};
  for (var stratumName in strataDict){
    addStratumGeom(stratumName, strataDict[stratumName]);
  }
}


function createToolPanel(){
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
  
  // AGC legend
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
  
  var colourBarParams = {
    bbox: [0, 0, 1, 0.1],
    dimensions: "100x10",
    format: "png",
    min: 0,
    max: 1,
    palette: agcVisParams.palette,
  };
  
  var colourBarThumbnail = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: colourBarParams,
    style: { stretch: "horizontal", margin: "0px 8px", maxHeight: "24px" },
  });
  
  // value labels for colour bar
  var legendValuesPanel = ui.Panel({
    widgets: [
      ui.Label(agcVisParams.min, { margin: "4px 8px" }),
      ui.Label(agcVisParams.max / 2, {
        margin: "4px 8px",
        textAlign: "center",
        stretch: "horizontal",
      }),
      ui.Label(agcVisParams.max, { margin: "4px 8px" }),
    ],
    layout: ui.Panel.Layout.flow("horizontal"),
  });
  
  toolPanel.add(colourBarThumbnail);
  toolPanel.add(legendValuesPanel);

  // chart label and placeholder
  var chartTitleLabel = ui.Label("Time Series", {
    fontWeight: "bold",
    fontSize: "20px",
    color: "SteelBlue",
  });
  toolPanel.add(chartTitleLabel);
  toolPanel.add(ui.Label('[Chart]'));  // placeholder

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
  return toolPanel;
}

function createAgcChart(mapPanel, toolPanel) {
  // Create AGC time series chart

  // get lists of drawn geometries and colours
  var layerFeats = [];
  var layerColors = [];
  var getDrawnGeometries = function(layer){
    var layerGeom = ee.FeatureCollection(layer.getEeObject()).geometry();
    layerFeats.push(ee.Feature(layerGeom, {name: layer.getName()}));
    layerColors.push(layer.getColor());
  };
  mapPanel.drawingTools().layers().forEach(getDrawnGeometries);
  print(layerFeats);

  // make a mean AGC time series chart for geometries
  var agcChart = ui.Chart.image.seriesByRegion(
    compColl.map(findAgc),  // TODO have an AGC collection up front rather than recreate
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
    hAxis: { title: "Year", format: "yy-MM" },
    colors: layerColors,
    legend: { position: "right" },
  });
  
  agcChart.onClick(function(xValue, yValue, seriesName) {
    print("agcChart.onClick");
    if (!xValue) return;  // Selection was cleared.
  
    // Show the image for the clicked date.
    var clickDate = ee.Date(xValue); //.get("year");
    addMapImageLayers(mapPanel, clickDate);
  });
  return agcChart;
}


// Initialise map and tool panels
var mapPanel = createMapPanel();
addMapImageLayers(mapPanel, "2017-11-15");
initMapDrawingLayers(mapPanel);

var toolPanel = createToolPanel();
var agcChart = createAgcChart(mapPanel, toolPanel);
toolPanel.widgets().set(10, agcChart);

// Set up event handlers
function drawingGeomChanged(geom, layer, widget) {
  // Drawing geometry changed event handler
  print("drawingGeomChanged");
  if (!geom) return;
  var agcChart = createAgcChart(mapPanel, toolPanel);
  toolPanel.widgets().set(10, agcChart);
}

function drawingLayerChanged(layer, widget) {
  // Drawing tools layer changed event handler
  print("drawingLayerChanged");
  if (!layer.geometries().length()) return;
  var agcChart = createAgcChart(mapPanel, toolPanel);
  toolPanel.widgets().set(10, agcChart);
}

mapPanel.drawingTools().onDraw(ui.util.debounce(drawingGeomChanged, 200));
mapPanel.drawingTools().onEdit(ui.util.debounce(drawingGeomChanged, 200));
mapPanel.drawingTools().onErase(ui.util.debounce(drawingGeomChanged, 200));
mapPanel.drawingTools().onLayerConfig(ui.util.debounce(drawingLayerChanged, 200));
mapPanel.drawingTools().onLayerRemove(ui.util.debounce(drawingLayerChanged, 200));

// Add map and tool panels to ui
ui.root.clear();
ui.root.add(ui.SplitPanel(toolPanel, mapPanel));


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

  



