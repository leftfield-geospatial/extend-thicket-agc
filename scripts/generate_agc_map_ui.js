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
var model = { m: ee.Number(ee_agc_model.first().get('m')), c: ee.Number(ee_agc_model.first().get('c')) };
// print(model);
var agc_image = (rn_image.log10().multiply(model.m).add(model.c)).uint8();
var agc_masked_image = agc_image.clip(thicket_boundary.geometry());

/*
  Create the map panel
*/
var mapPanel = ui.Map();

// Take all tools off the map except the zoom and mapTypeControl tools.
mapPanel.setControlVisibility({all: false, zoomControl: true, mapTypeControl: true});
mapPanel.setOptions('HYBRID');
mapPanel.centerObject(thicket_boundary);
var vis = { min: 0, max: 50, palette: 'red,yellow,green', opacity: 1.0 };
mapPanel.addLayer(agc_masked_image, vis, 'AGC');
mapPanel.layers().get(0).setOpacity(.55);

// Add these to the interface.
ui.root.widgets().reset([mapPanel]);
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));

/*
  Create the tool panel
*/

// Add a title and some explanatory text to a side panel.
var titleLabel = ui.Label('Thicket Aboveground Carbon (AGC)', {fontWeight: 'bold', fontSize: '24px', color: 'SteelBlue'});
var summaryLabel = ui.Label('Concept demonstration for extension of local AGC model(s) to the thicket biome',
    {fontSize: '14px'});
var detailLabel = ui.Label('An AGC model for a small area in the Baviaanskloof is re-calibrated and applied to ' +
        'arid and valley thicket areas using Landsat-8 imagery.', {fontSize: '11px'})
var noteLabel = ui.Label('Note that AGC accuracy outside the GEF-5 SLM Baviaanskloof study area has not been established.', {fontSize: '11px'});
var linkLabel = ui.Label('See the GitHub repositoty for more information.', {fontSize: '11px'}, 'https://github.com/dugalh/extend_thicket_agc');

var toolPanel = ui.Panel([titleLabel, summaryLabel, detailLabel, noteLabel, linkLabel], 
  ui.Panel.Layout.Flow('vertical'), {width: '300px'});
ui.root.widgets().add(toolPanel);


// Create a layer selector pulldown.
// The elements of the pulldown are the keys of the layerProperties dictionary.
var selectItems = Object.keys(layerProperties);

// // Define the pulldown menu.  Changing the pulldown menu changes the map layer
// // and legend.
// var layerSelect = ui.Select({
//   items: selectItems,
//   value: selectItems[0],
//   onChange: function(selected) {
//     // Loop through the map layers and compare the selected element to the name
//     // of the layer. If they're the same, show the layer and set the
//     // corresponding legend.  Hide the others.
//     mapPanel.layers().forEach(function(element, index) {
//       element.setShown(selected == element.getName());
//     });
//     setLegend(layerProperties[selected].legend);
//   }
// });

// // Add the select to the toolPanel with some explanatory text.
// toolPanel.add(ui.Label('View Different Layers', {'font-size': '24px'}));
// toolPanel.add(layerSelect);

// Create the legend.
// Define a panel for the legend and give it a tile.

var legendTitleLabel = ui.Label('Legend', {fontWeight: 'bold', fontSize: '20px', color: 'SteelBlue'});
toolPanel.add(legendTitle);
var legendDetailLabel = ui.Label('AGC (tC/ha)', {fontWeight: 'bold', fontSize: '14px', color: 'black'});
// var legendPanel = ui.Panel({widgets: [legendTitle, legendDetail], layout: ui.Panel.Layout.flow('vertical')});
// Create a visibility checkbox and an opacity slider.
//
// If the checkbox is clicked off, disable the layer pulldown and turn all the
// layers off. Otherwise, enable the select, and turn on the selected layer.
var legendCheckbox = ui.Checkbox({
  label: null,
  value: true,
  onChange: function(value) {
    mapPanel.layers().first().setShown(value);
    }
});

// Create an opacity slider. This tool will change the opacity for each layer.
// That way switching to a new layer will maintain the chosen opacity.
var opacitySlider = ui.Slider({
  min: 0,
  max: 1,
  value: 1,
  step: 0.01
});

opacitySlider.onSlide(function(value) {
  mapPanel.layers().forEach(function(element, index) {
    element.setOpacity(value);
  });
});

var legendHeaderPanel =
    ui.Panel([legendCheckbox, legendDetailLabel, opacitySlider], ui.Panel.Layout.Flow('horizontal'));
toolPanel.add(viewPanel);


function make_color_bar_params(palette) {
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
  style: { stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px' },
});

// Create a panel with three numbers for the legend.
var legend_labels = ui.Panel({
  widgets: [
    ui.Label(vis.min, { margin: '4px 8px' }),
    ui.Label(
      (vis.max / 2),
      { margin: '4px 8px', textAlign: 'center', stretch: 'horizontal' }),
    ui.Label(vis.max, { margin: '4px 8px' })
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

//var labelledColorBar = ui.Panel({ widgets: [color_bar, legend_labels],? layout: ui.Panel.Layout.flow('vertical')});
// var legendWidget = ui.Panel({ widgets: [legendDetail, labelledColorBar], layout: ui.Panel.Layout.flow('horizontal')});

toolPanel.add(color_bar);
toolPanel.add(legend_labels);

// Define an area for the legend key itself.
// This area will be replaced every time the layer pulldown is changed.
// var keyPanel = ui.Panel();
// legendPanel.add(keyPanel);

// function setLegend(legend) {
//   // Loop through all the items in a layer's key property,
//   // creates the item, and adds it to the key panel.
//   keyPanel.clear();
//   for (var i = 0; i < legend.length; i++) {
//     var item = legend[i];
//     var name = Object.keys(item)[0];
//     var color = item[name];
//     var colorBox = ui.Label('', {
//       backgroundColor: color,
//       // Use padding to give the box height and width.
//       padding: '8px',
//       margin: '0'
//     });
//     // Create the label with the description text.
//     var description = ui.Label(name, {margin: '0 0 4px 6px'});
//     keyPanel.add(
//         ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal')));
//   }
// }

// // Set the initial legend.
// setLegend(layerProperties[layerSelect.getValue()].legend);


// // Create the location pulldown.
// var locations = Object.keys(locationDict);
// var locationSelect = ui.Select({
//   items: locations,
//   value: locations[0],
//   onChange: function(value) {
//     var location = locationDict[value];
//     mapPanel.setCenter(location.lon, location.lat, location.zoom);
//   }
// });

// var locationPanel = ui.Panel([
//   ui.Label('Visit Example Locations', {'font-size': '24px'}), locationSelect
// ]);
// toolPanel.add(locationPanel);








// ------------------------------------------------------------------------------------------------------------------------------

// Creates a color bar thumbnail image for use in legend from the given color
// palette.

// var legend_title = ui.Label({
//   value: 'Legend: AGC 2017 (tC/ha)',
//   style: { fontWeight: 'bold' }
// });

// var slider = ui.Slider();
// slider.setValue(0.6);  // Set a default value.
// slider.onChange(function (value) {
//   Map.layers().get(0).setOpacity(value);
// });

// var slider_panel = ui.Panel({
//   widgets: [ui.Label('Opacity'), slider],
//   layout: ui.Panel.Layout.flow('horizontal')
// });
// // Add the legendPanel to the map.
// var legend_panel = ui.Panel({
//   widgets: [legend_title, slider_panel, color_bar, legend_labels,
//     ui.Label('More information').setUrl('https://github.com/dugalh/extend_thicket_agc')],
//   style: {
//     position: 'bottom-left',
//     padding: '4px 8px'
//   }
// });

// // Map.add(legend_panel);

// toolPanel.add(legend_panel)
