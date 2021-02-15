/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var step_arid_and_valley_thicket = ee.FeatureCollection("users/dugalh/step_arid_and_valley_thicket"),
    gef_calib_plots = ee.FeatureCollection("users/dugalh/gef_calib_plots");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
/*
    GEF5-SLM: Above ground carbon estimation in thicket using multi-spectral images
    Copyright (C) 2020 Dugal Harris
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

// Test the GEF univariate AGC model directly on Sentinel/Landsat surface reflectance
// agc = -318.8304 x log(R/pan) + 25.7259
//    where pan = (B + G + R + RE)

// The model Wv3 image is Oct 2017

// TODO: check s2 AGC (e.g. in calib plots and sampling plots) against wv3 AGC
// TODO: legend
// TODO: legend UI to select and mask different thicket types?  
// TODO: force map default to satellite
// TODO: force AGC opacity
// TODO: make gef_calib_plots an asset
// TODO: get all AGC sampling plots into an asset too
// TODO: try s2 srg
// TODO: filter s2 viewing geom 
// TODO: change to camelcaps
// TODO: rethink thicket boundaries
// TODO: make functions so I can pass l8 or s2 or ...

var model_m = ee.Number(-318.8304);
var model_c = ee.Number(25.7259);

function maskS2clouds(image) 
{
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask);
}

// var s2_dataset = ee.ImageCollection('COPERNICUS/S2_SR')    // not available for 2017
var s2_images = ee.ImageCollection('COPERNICUS/S2')
// var s2_dataset = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
                  .filterDate('2017-09-01', '2017-11-30')
                  // Pre-filter to get less cloudy granules.
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
                  .map(maskS2clouds)
                  .filterBounds(step_arid_and_valley_thicket);

if (true)
{
  var l8_images = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
                    .filterDate('2017-10-01', '2017-10-30')
                    .filterBounds(step_arid_and_valley_thicket);
  
  s2_images = l8_images
}


print('num s2 images: ', s2_images.count());
var s2_image = s2_images.mean()

var s2_rn = s2_image.expression('(R / (R + G + B + RE))', 
        {
          'R': s2_image.select('B4'),
          'G': s2_image.select('B3'),
          'B': s2_image.select('B2'),
          'RE': s2_image.select('B5'),
        }
      );

// find mean(rn) for each calib plot
var rn_calib_plots = s2_rn.reduceRegions({
  reducer: ee.Reducer.mean(),
  collection: gef_calib_plots,
  scale: 1
});

// print('rn_calib_plots');
// print(rn_calib_plots);

// find log(mean(rn)) for each calib plot, and add constant 1 for offset fit
var log_rn_calib_plots = rn_calib_plots.map(function(feature) {
  return feature.set({log_rn: ee.Number(feature.get('mean')).log10(), constant: 1});
});

print('log_rn_calib_plots: ', log_rn_calib_plots);

var calib_model = ee.Dictionary(log_rn_calib_plots.reduceColumns({
  reducer: ee.Reducer.linearRegression({
    numX: 2,
    numY: 1
  }),
  selectors: ['log_rn', 'constant', 'log(mean(R/pan))']
}));

var calib_coeff = ee.Array(calib_model.get('coefficients')).toList()
print('calib_model: ', calib_model)
print(calib_model.get('coefficients'))

// TODO understand why these casts are necessary
var calib_m = ee.Number(ee.List(ee.List(calib_coeff).get(0)).get(0));
var calib_c = ee.Number(ee.List(ee.List(calib_coeff).get(1)).get(0));

var s2_agc = s2_rn.log10().multiply(calib_m.multiply(model_m)).add(calib_c.multiply(model_m).add(model_c));

if (false)
{
  var min_agc = s2_agc.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: step_arid_and_valley_thicket,
    scale: 1e4,
    maxPixels: 1e6
  });
  
  print('min_agc: ', min_agc)
  
  var max_agc = s2_agc.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: step_arid_and_valley_thicket,
    scale: 1e4,
    maxPixels: 1e6
  });
  print('max_agc: ', max_agc)
}

var s2_agc_masked = s2_agc.clip(step_arid_and_valley_thicket.geometry())
Map.setOptions('TERRAIN');
Map.centerObject(step_arid_and_valley_thicket);
Map.addLayer(s2_agc_masked, {min: 0, max: 40, palette: ['red', 'yellow', 'green'], opacity: 0.8}, 'AGC');
// Map.addLayer(gef_calib_plots.draw({color: '660000', strokeWidth: 1}), {}, 'gef_calib_plots');
// Map.addLayer(step_arid_and_valley_thicket.draw({color: '000066', strokeWidth: 1, fill: -1}), {}, 'step_arid_and_valley_thicket');
// Map.addLayer(thicket_outline, {palette: '006600', opacity: 0.6}, 'thicket_outline');

// var visualization = {
//   min: 0.0,
//   max: [0.3, 0.3, 0.3],
//   bands: ['B4', 'B3', 'B2'],
// };
// Map.addLayer(s2_image.divide(10000), visualization, 'RGB');

