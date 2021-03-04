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
  .filterDate('2017-09-01', '2017-12-30')
  .filterBounds(thicketBoundary)
  .map(cloudMasking.landsat8_sr_cloud_mask);

var images = l8SrImages;
var image = images.median();    // composite the image collection

// Find R/pan image feature
function find_rn(image) {
  var rn_image = image.expression('(R / (R + G + B + RE))',
    {
      'R': image.select('B4'),
      'G': image.select('B3'),
      'B': image.select('B2'),
      'RE': image.select(ee.Algorithms.If(image.bandNames().contains('B8'), ['B8'], ['B5']))
    });
  return ee.Image(rn_image);
}
var rn_image = find_rn(image);

// Find the EE AGC image
var model = { m: ee.Number(eeAgcModel.first().get('m')), c: ee.Number(eeAgcModel.first().get('c')) };
var agc_image = (rn_image.log10().multiply(model.m).add(model.c)).uint8();
var agc_masked_image = agc_image.clip(thicketBoundary.geometry());

// Create the map panel with AGC overlay
var mapPanel = ui.Map();
mapPanel.setControlVisibility({all: false, zoomControl: true, mapTypeControl: true});
mapPanel.setOptions('HYBRID');
mapPanel.centerObject(thicketBoundary);
var vis = { min: 0, max: 50, palette: 'red,yellow,green', opacity: 1.0 };
mapPanel.addLayer(agc_masked_image, vis, 'AGC');
ui.root.widgets().reset([mapPanel]);
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));

// Create side tool panel

// Title and description
var titleLabel = ui.Label('Thicket Aboveground Carbon (AGC)', {fontWeight: 'bold', fontSize: '24px', color: 'SteelBlue'});
var summaryLabel = ui.Label('Concept demonstration for extension of local AGC model(s) to the thicket biome',
    {fontSize: '14px'});
var detailLabel = ui.Label('An AGC model for a small area in the Baviaanskloof is re-calibrated and applied to ' +
        'arid and valley thicket areas using Landsat-8 imagery.', {fontSize: '11px'});
var noteLabel = ui.Label('Note that AGC accuracy outside the GEF-5 SLM Baviaanskloof study area has not been established.', 
  {fontSize: '11px'});
var linkLabel = ui.Label('See the GitHub repositoty for more information.', {fontSize: '11px'}, 
  'https://github.com/dugalh/extend_thicket_agc');

var toolPanel = ui.Panel([titleLabel, summaryLabel, detailLabel, noteLabel, linkLabel], 
  ui.Panel.Layout.Flow('vertical'), {width: '300px'});
ui.root.widgets().add(toolPanel);

// Create the legend and its controls
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

// Value labels for colour bar
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