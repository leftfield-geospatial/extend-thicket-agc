/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var stepAridAndValleyThicket = ee.FeatureCollection("users/dugalh/extend_thicket_agc/step_arid_and_valley_thicket"),
    eeL8SrAgcModel = ee.FeatureCollection("users/dugalh/extend_thicket_agc/ee_l8_sr_agc_model");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
var cloudMasking = require("users/dugalh/extend_thicket_agc:modules/cloud_masking.js");
var thicketBoundary = stepAridAndValleyThicket; // STEP derived thicket boundaries

// var s2ToaImages = ee.ImageCollection('COPERNICUS/S2')
//                   .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
//                   .filterBounds(thicketBoundary)
//                   .map(cloudMasking.s2SimpleCloudMask);

// // Obtain Landsat8 SR image collection of thicket around time of GEF-5 SLM WV3 acquisition
var l8SrImages = ee.ImageCollection("LANDSAT/LC08/C01/T1_SR")
  .filterMetadata("GEOMETRIC_RMSE_MODEL", "less_than", 10)
  // .filterMetadata('SOLAR_ZENITH_ANGLE', "greater_than", 40)
  // .filterMetadata('SOLAR_AZIMUTH_ANGLE', "less_than", 50)
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
    R: image.select("B4"),
    G: image.select("B3"),
    B: image.select("B2"),
    RE: image.select(
      ee.Algorithms.If(image.bandNames().contains("B8"), ["B8"], ["B5"])
    ),
  });
  
  return ee.Image(rnImage
    .log10()
    .multiply(model.m)
    .add(model.c)
    .set("system:time_start", image.get("system:time_start"))
  ).rename("AGC");
}

// Apply the model to find the EE AGC image
var agcImage = findAgc(image).uint8();
var agcMaskedImage = agcImage.clip(thicketBoundary.geometry());

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
  "Concept demonstration for extension of local AGC model(s) to the thicket biome",
  { fontSize: "14px" }
);
var detailLabel = ui.Label(
  "An AGC model for a small area in the Baviaanskloof is re-calibrated and applied to " +
    "arid and valley thicket areas using Landsat-8 imagery.",
  { fontSize: "11px" }
);
var noteLabel = ui.Label(
  "Note that AGC accuracy outside the GEF-5 SLM Baviaanskloof study area has not been established.",
  { fontSize: "11px" }
);
var linkLabel = ui.Label(
  "See the GitHub repositoty for more information.",
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

if (false) // create a time series of yearly AGC
{
  var agcTimeSeriesChart = function(coords) {
    // show the clicket point
    var point = ee.Geometry.Point(coords.lon, coords.lat);
    var dot = ui.Map.Layer(point, { color: "000000" }, "clicked location");
    mapPanel.layers().set(1, dot);
  
    // find [median(images) for images inbetween Sept and Dec in each year]
    var years = ee.List.sequence(2013, 2020);
    var yearlyMedianImages = ee.ImageCollection.fromImages(years.map(function (y) {
        return images
          .filter(ee.Filter.calendarRange(y, y, "year"))
          .filter(ee.Filter.calendarRange(9, 12, "month"))
          .median()
          .set("year", y)
          .set("system:time_start", ee.Date.fromYMD(y, 10, 15));
      }).flatten()
    );
  
    // make a chart of agc(median images)
    var agcChart = ui.Chart.image.series(
      yearlyMedianImages.map(findAgc),
      point.buffer(100),
      ee.Reducer.median(),
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
var creditsTitleLabel = ui.Label("Credits", {
  fontWeight: "bold",
  fontSize: "20px",
  color: "SteelBlue",
});

var stepDescrLabel = ui.Label(
  "Thicket boundaries: ",
  { fontSize: "11px" }
);
var stepLinkLabel = ui.Label(
  "STEP Vegetation Map",  
  { fontSize: "11px" },
  "https://bgis.sanbi.org/SpatialDataset/Detail/194"
);
var stepPanel = ui.Panel([stepDescrLabel, stepLinkLabel]);

var gefDescrLabel = ui.Label(
  "AGC model: ",  
  { fontSize: "11px" }
);
var gefLinkLabel = ui.Label(
  "GEF-5 SLM project",
  { fontSize: "11px" },
  "https://github.com/dugalh/map_thicket_agc"
);
var gefPanel = ui.Panel([gefDescrLabel, gefLinkLabel]);

var creditsPanel = ui.Panel(
  [creditsTitleLabel, stepPanel, gefPanel],
  ui.Panel.Layout.Flow("vertical")
);
toolPanel.add(creditsPanel);

// add map and tool panels to ui
ui.root.clear();
ui.root.add(ui.SplitPanel(toolPanel, mapPanel));
