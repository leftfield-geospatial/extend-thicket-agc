/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var ee_agc_image = ee.Image("users/dugalh/extend_thicket_agc/ee_agc_image"),
    step_arid_and_valley_thicket = ee.FeatureCollection("users/dugalh/extend_thicket_agc/step_arid_and_valley_thicket");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// Apply the EE model and to EE imagery

var thicket_boundary = step_arid_and_valley_thicket;  // STEP derived thicket boundaries

var agc_image = ee_agc_image;
var agc_masked_image = agc_image.clip(thicket_boundary.geometry())

var vis = { min: 0, max: 50, palette: 'red,yellow,green', opacity: 1.0 }

Map.setOptions('HYBRID');
Map.centerObject(thicket_boundary);
Map.addLayer(agc_masked_image, vis, 'AGC');
Map.layers().get(0).setOpacity(.55)

// Creates a color bar thumbnail image for use in legend from the given color
// palette.
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

var legend_title = ui.Label({
  value: 'Legend: AGC 2017 (tC/ha)',
  style: { fontWeight: 'bold' }
});

var slider = ui.Slider();
slider.setValue(0.6);  // Set a default value.
slider.onChange(function (value) {
  Map.layers().get(0).setOpacity(value);
});

var slider_panel = ui.Panel({
  widgets: [ui.Label('Opacity'), slider],
  layout: ui.Panel.Layout.flow('horizontal')
});
// Add the legendPanel to the map.
var legend_panel = ui.Panel({
  widgets: [legend_title, slider_panel, color_bar, legend_labels,
    ui.Label('More information').setUrl('https://github.com/dugalh/extend_thicket_agc')],
  style: {
    position: 'bottom-left',
    padding: '4px 8px'
  }
});

Map.add(legend_panel);
