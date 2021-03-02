/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var step_arid_and_valley_thicket = ee.FeatureCollection("users/dugalh/extend_thicket_agc/step_arid_and_valley_thicket"),
    gef_calib_plots = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_calib_plots"),
    gef_sampling_plots = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_sampling_plots"),
    ee_agc_model = ee.FeatureCollection("users/dugalh/extend_thicket_agc/ee_agc_model");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// Apply the EE model and to EE imagery

var cloud_masking = require('users/dugalh/extend_thicket_agc:modules/cloud_masking.js');
var thicket_boundary = step_arid_and_valley_thicket;  // STEP derived thicket boundaries

// var s2_toa_images = ee.ImageCollection('COPERNICUS/S2')
//                   .filterDate('2017-09-01', '2017-11-01')
//                   .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
//                   .filterBounds(thicket_boundary)
//                   .map(cloud_masking.s2_simple_cloud_mask);

var l8_sr_images = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR') //ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')  
                    .filterDate('2017-09-01', '2017-12-30')
                    .filterBounds(thicket_boundary)
                    .map(cloud_masking.landsat8_sr_cloud_mask);

var images = l8_sr_images;
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

// find the EE AGC image
var model = {m: ee.Number(ee_agc_model.first().get('m')), c: ee.Number(ee_agc_model.first().get('c'))};
// print(model);
var agc_image = (rn_image.log10().multiply(model.m).add(model.c)).uint8();
var agc_masked_image = agc_image.clip(thicket_boundary.geometry())

var vis = {min: 0, max: 50, palette: 'red,yellow,green', opacity: 1.0}

Map.setOptions('HYBRID');
Map.centerObject(thicket_boundary);
Map.addLayer(agc_masked_image, vis, 'AGC');
Map.layers().get(0).setOpacity(.55)

// Creates a color bar thumbnail image for use in legend from the given color
// palette.
function make_color_bar_params(palette) 
{
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: '100x10',
    format: 'png',
    min: 0,
    max: 1,
    palette: palette,
  };
}

// Create the color bar for the legend.
var color_bar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: make_color_bar_params(vis.palette),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legend_labels = ui.Panel({
  widgets: [
    ui.Label(vis.min, {margin: '4px 8px'}),
    ui.Label(
        (vis.max / 2),
        {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
    ui.Label(vis.max, {margin: '4px 8px'})
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legend_title = ui.Label({
  value: 'Legend: AGC 2017 (tC/ha)',
  style: {fontWeight: 'bold'}
});

var slider = ui.Slider();
  slider.se
  slider.setValue(0.6);  // Set a default value.
  slider.onChange(function(value) {
    Map.layers().get(0).setOpacity(value);
  });

var slider_panel = ui.Panel({
  widgets: [ui.Label('Opacity'), slider],
  layout: ui.Panel.Layout.flow('horizontal')
});
// Add the legendPanel to the map.
var legend_panel = ui.Panel({widgets: [legend_title, slider_panel, color_bar, legend_labels, 
                                        ui.Label('More information').setUrl('https://github.com/dugalh/extend_thicket_agc')],   
                            style: {
                                position: 'bottom-left',
                                padding: '4px 8px'
                              }});

Map.add(legend_panel);
