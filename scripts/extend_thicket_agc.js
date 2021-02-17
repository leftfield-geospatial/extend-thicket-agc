/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var step_arid_and_valley_thicket = ee.FeatureCollection("users/dugalh/extend_thicket_agc/step_arid_and_valley_thicket"),
    gef_calib_plots = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_calib_plots"),
    gef_sampling_plots = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_sampling_plots");
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

// TODO: legend
// TODO: legend UI to select and mask different thicket types?  
// TODO: try s2 sr
// TODO: filter s2 viewing geom (solar zenith close to 0, and satellite )
// TODO: change to camelcaps
// TODO: rethink thicket boundaries
// TODO: make functions so I can pass l8 or s2 or ...
// TODO: do a cross-validated accuracy test of WV3 agc vs S2 agc, using calib plots
// TODO: time series of ndvi/rn/agc in thicket
// TODO: tool to find AGC in a user selected polygon


var model_m = ee.Number(-318.8304);
var model_c = ee.Number(25.7259);


function s2_cloud_mask(image) 
{
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask);
}

function find_rn(image, type) 
{
  // print('image metadata: ', image);
  // print('SPACECRAFT_NAME: ', image.get('SPACECRAFT_NAME'))
  // print('S2?: ', ee.Algorithms.If(ee.String(type).index('Sentinel').gte(0), 'Sentinel', 'Not Sentinel'))
  
  var rn_image = ee.Algorithms.If(ee.String(type).index('Sentinel').gte(0), 
            image.expression('(R / (R + G + B + RE))', 
              {
                'R': image.select('B4'),
                'G': image.select('B3'),
                'B': image.select('B2'),
                'RE': image.select('B8'),
              }),
            image.expression('(R / (R + G + B + RE))', 
              {
                'R': image.select('B4'),
                'G': image.select('B3'),
                'B': image.select('B2'),
                'RE': image.select('B5'),
              })
            );
    return ee.Image(rn_image);
}

function model_agc(rn_image)
{
  // fit calibration transform
  var rn_calib_plots = rn_image.reduceRegions({
    reducer: ee.Reducer.mean(),
    collection: gef_calib_plots,
    scale: 1});
  
  // print('rn_calib_plots');
  // print(rn_calib_plots);
  
  // find log(mean(rn)) for each calib plot, and add constant 1 for offset fit
  var log_rn_calib_plots = rn_calib_plots.map(function(feature) {
    return feature.set({extend_log_rn: ee.Number(feature.get('mean')).log10(), constant: 1});
  });
  
  print('log_rn_calib_plots: ', log_rn_calib_plots);
  
  var calib_model = ee.Dictionary(log_rn_calib_plots.reduceColumns({
    reducer: ee.Reducer.linearRegression({
      numX: 2,
      numY: 1
    }),
    selectors: ['extend_log_rn', 'constant', 'log(mean(R/pan))']
  }));
  
  var calib_coeff = ee.Array(calib_model.get('coefficients')).toList()
  print('calib_model: ', calib_model)
  print(calib_model.get('coefficients'))
  var calib_m = ee.Number(ee.List(calib_coeff.get(0)).get(0));
  var calib_c = ee.Number(ee.List(calib_coeff.get(1)).get(0));
  
  // apply calibration transform and AGC model in one step
  var agc_image = rn_image.log10().multiply(calib_m.multiply(model_m)).add(calib_c.multiply(model_m).add(model_c));
  
  return agc_image;
}

function accuracy_check(plots, agc_image)
{
  var agc_field = 'AgcHa'
  var agc_plots = agc_image.reduceRegions({
    reducer: ee.Reducer.mean(),
    collection: plots,
    scale: 1
  });

  print('agc_plots: ', agc_plots)

  // find residual sum of squares
  var agc_res_ss = agc_plots.map(function(feature) {
    return feature.set({agc_res2: (ee.Number(feature.get('mean')).subtract(feature.get(agc_field))).pow(2)});
  }).reduceColumns(ee.Reducer.sum(), ['agc_res2'])

  var agc_rms = (ee.Number(agc_res_ss.get('sum')).divide(agc_plots.size())).sqrt()
  print('agc_rms: ', agc_rms)

  // find sum of squares
  var agc_mean = ee.Number(agc_plots.reduceColumns(ee.Reducer.mean(), [agc_field]).get('mean'));
  print('agc_mean: ', agc_mean)
  
  var agc_ss = agc_plots.map(function(feature) {
    return feature.set({agc_off2: (ee.Number(feature.get('mean')).subtract(agc_mean)).pow(2)});
  }).reduceColumns(ee.Reducer.sum(), ['agc_off2'])
  
  var agc_r2 = ee.Number(1).subtract(ee.Number(agc_res_ss.get('sum')).divide(ee.Number(agc_ss.get('sum'))))
  print('agc_r2: ', agc_r2)
}

var s2_toa_images = ee.ImageCollection('COPERNICUS/S2')
                  .filterDate('2017-09-01', '2017-11-30')
                  // Pre-filter to get less cloudy granules.
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))  // CLOUDY_PIXEL_PERCENTAGE is in metadata (not a band)
                  .map(s2_cloud_mask)
                  .filterBounds(step_arid_and_valley_thicket);

var s2_sr_images = ee.ImageCollection('COPERNICUS/S2')
                  .filterDate('2019-09-01', '2019-11-30')
                  // Pre-filter to get less cloudy granules.
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))  // CLOUDY_PIXEL_PERCENTAGE is in metadata (not a band)
                  .map(s2_cloud_mask)
                  .filterBounds(step_arid_and_valley_thicket);

if (false)
{
  var l8_images = ee.ImageCollection('LANDSAT/LC08/C01/T2_SR')
                    .filterDate('2017-09-01', '2017-11-30')
                    .filterBounds(step_arid_and_valley_thicket);
  
  images = l8_images
}

var images = s2_toa_images
print('num images: ', images.size());
print('images metadata: ', images);
print('image metadata: ', images.first());
// print('SPACECRAFT_NAME: ', images.first().get('SPACECRAFT_NAME'));

var image = images.mean();
var rn_image = find_rn(image, ee.String(images.first().get('SPACECRAFT_NAME')));
print('rn_image: ', rn_image);
var agc_image = model_agc(rn_image);

print('Calib Accuracy:');
accuracy_check(gef_calib_plots, agc_image, 'calib');
// convert AgcHa from kg to tons
gef_sampling_plots = gef_sampling_plots.map(function(feature){return feature.set({AgcHa: ee.Number(feature.get('AgcHa')).divide(1000)})})
print('Sampling Accuracy:');
accuracy_check(gef_sampling_plots, agc_image, 'sampling');

if (false)
{
  var min_agc = agc_image.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: step_arid_and_valley_thicket,
    scale: 1e4,
    maxPixels: 1e6
  });
  
  print('min_agc: ', min_agc)
  
  var max_agc = agc_image.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: step_arid_and_valley_thicket,
    scale: 1e4,
    maxPixels: 1e6
  });
  print('max_agc: ', max_agc)
}

var agc_masked_image = agc_image.clip(step_arid_and_valley_thicket.geometry())
Map.setOptions('TERRAIN');
Map.centerObject(step_arid_and_valley_thicket);
Map.addLayer(agc_masked_image, {min: 0, max: 40, palette: ['red', 'yellow', 'green'], opacity: 0.8}, 'AGC');
// Map.addLayer(gef_calib_plots.draw({color: '660000', strokeWidth: 1}), {}, 'gef_calib_plots');
// Map.addLayer(step_arid_and_valley_thicket.draw({color: '000066', strokeWidth: 1, fill: -1}), {}, 'step_arid_and_valley_thicket');
// Map.addLayer(thicket_outline, {palette: '006600', opacity: 0.6}, 'thicket_outline');

// var visualization = {
//   min: 0.0,
//   max: [0.3, 0.3, 0.3],
//   bands: ['B4', 'B3', 'B2'],
// };
// Map.addLayer(s2_image.divide(10000), visualization, 'RGB');

