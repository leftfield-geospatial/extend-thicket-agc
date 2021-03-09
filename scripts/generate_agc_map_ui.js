/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var stepAridAndValleyThicket = ee.FeatureCollection("users/dugalh/extend_thicket_agc/step_arid_and_valley_thicket"),
    eeAgcModel = ee.FeatureCollection("users/dugalh/extend_thicket_agc/ee_agc_model");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
var cloudMasking = require('users/dugalh/extend_thicket_agc:modules/cloud_masking.js');
var thicketBoundary = stepAridAndValleyThicket;  // STEP derived thicket boundaries

// var s2_toa_images = ee.ImageCollection('COPERNICUS/S2')
//                   .filterDate('2017-09-01', '2017-11-01')
//                   .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
//                   .filterBounds(thicketBoundary)
//                   .map(cloudMasking.s2_simple_cloud_mask);

// Obtain Landsat8 SR image collection of thicket around time of GEF-5 SLM WV3 acquisition
var l8SrImages = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
  .filterBounds(thicketBoundary)
  .filterMetadata('GEOMETRIC_RMSE_MODEL', "less_than", 10)
  .filterMetadata('SOLAR_ZENITH_ANGLE', "greater_than", 45)
  // .filterMetadata('SOLAR_AZIMUTH_ANGLE', "less_than", 50)
  .map(cloudMasking.landsat8_sr_cloud_mask);

var images = l8SrImages.filterDate('2017-09-01', '2017-11-30');
print(images);
var image = images.median();    // composite the image collection
var model = { m: ee.Number(eeAgcModel.first().get('m')), c: ee.Number(eeAgcModel.first().get('c')) };

// Find R/pan image feature
function findRn(image) {
  var rnImage = image.expression('(R / (R + G + B + RE))',
    {
      'R': image.select('B4'),
      'G': image.select('B3'),
      'B': image.select('B2'),
      'RE': image.select(ee.Algorithms.If(image.bandNacopyPromes().contains('B8'), ['B8'], ['B5']))
    });
  return ee.Image(rnImage);
}

function findAgc(image) {
  var rnImage = image.expression('(R / (R + G + B + RE))',
    {
      'R': image.select('B4'),
      'G': image.select('B3'),
      'B': image.select('B2'),
      'RE': image.select(ee.Algorithms.If(image.bandNames().contains('B8'), ['B8'], ['B5']))
    });
  return ee.Image(rnImage.log10().multiply(model.m).add(model.c)
    .set('system:time_start', image.get('system:time_start')))
    .rename('AGC');
}

// var rnImage = findRn(image);
// Apply the model to find the EE AGC image
var agcImage = findAgc(image).uint8();
var agcMaskedImage = agcImage.clip(thicketBoundary.geometry());

// Create the map panel with AGC overlay
var mapPanel = ui.Map();
mapPanel.setControlVisibility({all: false, zoomControl: true, mapTypeControl: true});
mapPanel.setOptions('HYBRID');
mapPanel.centerObject(thicketBoundary);
var vis = { min: 0, max: 50, palette: 'red,yellow,green', opacity: 1.0 };
mapPanel.addLayer(agcMaskedImage, vis, 'AGC');

// Create side tool panel
// title and description
var titleLabel = ui.Label('Thicket Aboveground Carbon (AGC)', {fontWeight: 'bold', fontSize: '24px', color: 'SteelBlue'});
var summaryLabel = ui.Label('Concept demonstration for extension of local AGC model(s) to the thicket biome',
    {fontSize: '14px'});
var detailLabel = ui.Label('An AGC model for a small area in the Baviaanskloof is re-calibrated and applied to ' +
        'arid and valley thicket areas using Landsat-8 imagery.', {fontSize: '11px'});
var noteLabel = ui.Label('Note that AGC accuracy outside the GEF-5 SLM Baviaanskloof study area has not been established.', 
  {fontSize: '11px'});
var linkLabel = ui.Label('See the GitHub repositoty for more information.', {fontSize: '11px'}, 
  'https://github.com/dugalh/extend_thicket_agc');

var toolPanel = ui.Panel({widgets: [titleLabel, summaryLabel, detailLabel, noteLabel, linkLabel], 
  layout: ui.Panel.Layout.Flow('vertical'), style: {width: '20%'}});

// legend and its controls
var legendTitleLabel = ui.Label('Legend', {fontWeight: 'bold', fontSize: '20px', color: 'SteelBlue'});
toolPanel.add(legendTitleLabel);

var legendDetailLabel = ui.Label('AGC (tC/ha)', {fontWeight: 'bold', fontSize: '14px', color: 'black'});
var legendCheckbox = ui.Checkbox({
  label: null,
  value: true,
  onChange: function(value) {
    mapPanel.layers().get(0).setShown(value);
    }
});
var legendOpacitySlider = ui.Slider({
  min: 0,
  max: 1,
  value: 1,
  step: 0.01
});

legendOpacitySlider.onSlide(function(value) {
  mapPanel.layers().forEach(function(element, index) {
    element.setOpacity(value);
  });
});

var legendHeaderPanel =
    ui.Panel([legendCheckbox, legendDetailLabel, legendOpacitySlider], ui.Panel.Layout.Flow('horizontal'));
toolPanel.add(legendHeaderPanel);
legendOpacitySlider.setValue(0.6, true);

function makeColourBarParams(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: '100x10',
    format: 'png',
    min: 0,
    max: 1,
    palette: palette,
  };
}

var colourBarThumbnail = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColourBarParams(vis.palette),
  style: { stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px' },
});

// value labels for colour bar
var legendValuesPanel = ui.Panel({
  widgets: [
    ui.Label(vis.min, { margin: '4px 8px' }),
    ui.Label(
      (vis.max / 2),
      { margin: '4px 8px', textAlign: 'center', stretch: 'horizontal' }),
    ui.Label(vis.max, { margin: '4px 8px' })
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

toolPanel.add(colourBarThumbnail);
toolPanel.add(legendValuesPanel);

// Chart 

// Generates a new time series chart of SST for the given coordinates.
var generateChart = function (coords) {
  // Update the lon/lat panel with values from the click event.
  // lon.setValue('lon: ' + coords.lon.toFixed(2));
  // lat.setValue('lat: ' + coords.lat.toFixed(2));

  // Add a dot for the point clicked on.
  var point = ee.Geometry.Point(coords.lon, coords.lat);
  var dot = ui.Map.Layer(point, {color: '000000'}, 'clicked location');
  // Add the dot as the second layer, so it shows up on top of the composite.
  mapPanel.layers().set(1, dot);

  // Make a time series chart of agc([median(images) for images inbetween Sept and Dec in year y])
  var years = ee.List.sequence(2013, 2020);
  var yearlyMedianImages = ee.ImageCollection.fromImages(years.map(function(y) {
      return l8SrImages.filter(ee.Filter.calendarRange(y, y, 'year')).filter(ee.Filter.calendarRange(9, 12, 'month'))
          .median().set('year', y);
    }).flatten());
  print(yearlyMedianImages);
  var agcChart = ui.Chart.image.series(yearlyMedianImages.map(findAgc), point.buffer(30), ee.Reducer.median(), 30);

  // Customize the chart.
  agcChart.setOptions({
    title: 'AGC: time series',
    vAxis: {title: 'AGC (tC/ha)'},
    hAxis: {title: 'Date', format: 'MM-yy', gridlines: {count: 7}},
    series: {
      0: {
        color: 'blue',
        lineWidth: 0,
        pointsVisible: true,
        pointSize: 2,
      },
    },
    legend: {position: 'right'},
  });
  // Add the chart at a fixed position, so that new charts overwrite older ones.
  toolPanel.widgets().set(10, agcChart);
};
mapPanel.onClick(generateChart);
mapPanel.style().set('cursor', 'crosshair');

// Initialize with a test point.
var initialPoint = ee.Geometry.Point(24.5, -33.5);
// mapPanel.centerObject(initialPoint, 4);

var chartTitleLabel = ui.Label('Time Series', {fontWeight: 'bold', fontSize: '20px', color: 'SteelBlue'});
toolPanel.add(chartTitleLabel);

generateChart({
  lon: initialPoint.coordinates().get(0).getInfo(),
  lat: initialPoint.coordinates().get(1).getInfo()
});

// Replace the root with a SplitPanel that contains the inspector and map.
ui.root.clear();
ui.root.add(ui.SplitPanel(toolPanel, mapPanel));
