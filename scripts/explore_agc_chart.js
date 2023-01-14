/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var stepAridAndValleyThicket = ee.FeatureCollection("users/dugalh/extend_thicket_agc/step_arid_and_valley_thicket"),
    eeL8SrAgcModel = ee.FeatureCollection("users/dugalh/extend_thicket_agc/ee_l8_sr_agc_model");
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

var cloudMasking = require("users/dugalh/extend_thicket_agc:extend_thicket_agc/cloud_masking.js");
var thicketBoundary = stepAridAndValleyThicket; // STEP derived thicket boundaries
var thicketBounds = stepAridAndValleyThicket.union().geometry().bounds();

// obtain Landsat 8 SR image collection of thicket around time of GEF-5 SLM WV3 acquisition
var cloudlessColl = ee.ImageCollection("LANDSAT/LC08/C01/T1_SR")
  .filterMetadata("GEOMETRIC_RMSE_MODEL", "less_than", 10)
  .filterMetadata("CLOUD_COVER_LAND", "less_than", 50)
  .filterBounds(thicketBounds)
  .map(cloudMasking.landsat8SrCloudMask);
  
// var l8SrImages = ee.ImageCollection("LANDSAT/LC08/C01/T1_SR")
//   .filterMetadata("GEOMETRIC_RMSE_MODEL", "less_than", 10)
//   .filterMetadata("CLOUD_COVER_LAND", "less_than", 50)
//   .filterDate("2017-09-01", "2017-12-30")
//   .filterBounds(thicketBoundary)
//   .map(cloudMasking.landsat8SrCloudMask);
  
function cloudlessComposite(year){
  return cloudlessColl.filter(ee.Filter.calendarRange(year, year, "year"))
  .filter(ee.Filter.calendarRange(1, 12, "month"))
  .median()
  .set("year", year)
  .set("system:time_start", ee.Date.fromYMD(year, 7, 1));
}

var eeAgcModel = eeL8SrAgcModel;
// var images = l8SrImages;
var image = cloudlessComposite(2017);

// var image = images
//   .median(); // composite the image collection
  
var model = {
  m: ee.Number(eeAgcModel.first().get("m")),
  c: ee.Number(eeAgcModel.first().get("c")),
};

// apply EE AGC model to image
function findAgc(image) {
  var rnImage = image.expression("(R / (R + G + B + RE))", {
    R: image.select("B4"),
    G: image.select("B3"),
    B: image.select("B2"),
    // RE: image.select(
    //   ee.Algorithms.If(image.bandNames().contains("B8"), ["B8"], ["B5"])
    // ),
    RE: image.select("B5"),
  });
  
  return ee.Image(rnImage.log10()
    .multiply(model.m)
    .add(model.c)
    .set("system:time_start", image.get("system:time_start"))
  ).rename("AGC");
}


// Apply the model to find the EE AGC image(s)
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

if (true) // create a time series of yearly AGC
{
  var agcTimeSeriesChart = function(coords) {
    // show the clicket point
    var point = ee.Geometry.Point(coords.lon, coords.lat);
    var dot = ui.Map.Layer(point, { color: "000000" }, "clicked location");
    mapPanel.layers().set(1, dot);
  
    // find [median(images) for images inbetween Sept and Dec in each year]
    var years = ee.List.sequence(2014, 2022);
    var yearlyMedianImages = ee.ImageCollection.fromImages(
      years.map(cloudlessComposite).flatten()
    );
  
    // print(yearlyMedianImages.size());
    // print(yearlyMedianImages.first().reduce(ee.Reducer.mean()));
  
    // make a chart of agc(median images)
    var agcChart = ui.Chart.image.series(
      yearlyMedianImages.map(findAgc),
      point.buffer(100),
      ee.Reducer.mean(),
      30
    );
  
    agcChart.setOptions({
      title: "AGC: time series",
      vAxis: { title: "AGC (tC/ha)" },
      hAxis: { title: "Date", format: "MM-yy", gridlines: { count: 7 } },
      series: {
        0: {
          color: "SteelBlue",
          lineWidth: 1,
          pointsVisible: true,
          pointSize: 3,
        },
      },
      legend: { position: "right" },
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
  mapPanel.onClick(agcTimeSeriesChart);
  mapPanel.style().set("cursor", "crosshair");
  
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
  
  agcTimeSeriesChart({
    lon: initialPoint.coordinates().get(0).getInfo(),
    lat: initialPoint.coordinates().get(1).getInfo(),
  });
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
