/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var step_arid_and_valley_thicket = ee.FeatureCollection("users/dugalh/extend_thicket_agc/step_arid_and_valley_thicket"),
    gef_calib_plots = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_calib_plots"),
    gef_sampling_plots = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_sampling_plots"),
    gef_calib_plots_l8_nir1_xlate = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_calib_plots_l8_nir1_xlate"),
    gef_calib_plots_l8_nir1 = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_calib_plots_l8_nir1"),
    gef_calib_plots_l8_nir2 = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_calib_plots_l8_nir2"),
    gef_calib_plots_l8_nir2_xlate = ee.FeatureCollection("users/dugalh/extend_thicket_agc/gef_calib_plots_l8_nir2_xlate");
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
//x TODO: try s2 sr
//x TODO: filter s2 viewing geom (solar and satellite zenith close to 0)
// TODO: change to camelcaps
// TODO: rethink thicket boundaries
//x TODO: make functions so I can pass l8 or s2 or ...
// TODO: do a cross-validated accuracy test of WV3 agc vs S2 agc, using calib plots
// TODO: time series of ndvi/rn/agc in thicket
// TODO: tool to find AGC in a user selected polygon, and trend over time
// TODO: about UI with link to me, cite me somehow
// TODO: landsat and better s2 cloud mask - maybe not the shadow projection, 
//     the simple QA0 thing is not working great for S2, and SR data looks better, even if it doesn't make better AGC?
// TODO: try median composite instead of mean
// TODO: compare simple and complex s2 cloud masks
// TODO: is there a simple way of improving the s2 cloud mask?
// TODO: try build a model with an NIR band that is closer to the L8 one, and see if L8 accuracy improves
// TODO: time the different s2 cloud mask options

// NOTES
// L8 T2_SR has v few images to work with.
// L8 T1_SR is about a pixel (30m) off, but otherwise works ok
// L8 T1_SR with landsat8_sr_cloud_mask produces decent cloud free images
// S2 TOA has visible clouds with s2_cloud_mask and prob needs 'COPERNICUS/S2_CLOUD_PROBABILITY' 
// S2 SR is is noticeably less hazy than TOA, but only available from 2019... why is that?
// S2 TOA geom accuracy is much better than L8 T1
// The cloud prob S2 masking is very slow for our large ROI and for the particular time span of interest, makes very little difference to AGC acc


var cloud_masking = require('users/dugalh/extend_thicket_agc:modules/cloud_masking.js');

// the univariate log(mean(R/pan)) model with pan = (R + G + B + RE) from https://github.com/dugalh/map_thicket_agc
var agc_model = {m: ee.Number(-318.8304), c: ee.Number(25.7259)};
// var agc_model = {m: ee.Number(-252.1986), c: ee.Number(16.9453)};  // pan = (R + G + B + NIR1)
// var agc_model = {m: ee.Number(-245.6729), c: ee.Number(11.5778)};  // pan = (R + G + B + NIR1)
print(agc_model);

function find_rn(image) 
{
  var rn_image = ee.Algorithms.If(image.bandNames().contains('B8'), 
            image.expression('(R / (R + G + B + RE))', //Sentinel
              {
                'R': image.select('B4'),
                'G': image.select('B3'),
                'B': image.select('B2'),
                'RE': image.select('B8'),
              }),
            image.expression('(R / (R + G + B + RE))',  //Landsat
              {
                'R': image.select('B4'),
                'G': image.select('B3'),
                'B': image.select('B2'),
                'RE': image.select('B5'),
              })
            );
    return ee.Image(rn_image);
}

function model_agc(rn_image, train_plots)
{
  // fit calibration transform
  var rn_plots = rn_image.reduceRegions({
    reducer: ee.Reducer.mean(),
    collection: train_plots,
    scale: 1});
  
  // print('rn_calib_plots');
  // print(rn_calib_plots);
  
  // find log(mean(rn)) for each calib plot, and add constant 1 for offset fit
  var log_rn_plots = rn_plots.map(function(feature) {
    return feature.set({extend_log_rn: ee.Number(feature.get('mean')).log10(), constant: 1});
  });
  
  // print('log_rn_calib_plots: ', log_rn_calib_plots);

  var calib_ee_model = ee.Dictionary(log_rn_plots.reduceColumns({
    reducer: ee.Reducer.linearRegression({
      numX: 2,
      numY: 1
    }),
    selectors: ['extend_log_rn', 'constant', 'log(mean(R/pan))']
  }));
  print('calib_ee_model: ', calib_model);
  
  var calib_coeff = ee.Array(calib_ee_model.get('coefficients')).toList();
  // print(calib_model.get('coefficients'))
  var calib_model = {m: ee.Number(ee.List(calib_coeff.get(0)).get(0)), c: ee.Number(ee.List(calib_coeff.get(1)).get(0))};
  
  // apply calibration transform and AGC model in one step
  var agc_image = rn_image.log10().multiply(calib_model.m.multiply(agc_model.m)).add(calib_model.c.multiply(agc_model.m).add(agc_model.c));
  
  return agc_image;
}

function accuracy_check(agc_image, test_plots)
{
  var agc_field = 'AgcHa';
  var pred_agc_field = 'mean';
  
  var agc_plots = agc_image.reduceRegions({
    reducer: ee.Reducer.mean(),
    collection: test_plots,
    scale: 1
  });

  // print('agc_plots: ', agc_plots)

  // find residual sum of squares
  var agc_res_ss = agc_plots.map(function(feature) {
    return feature.set({agc_res2: (ee.Number(feature.get(pred_agc_field)).subtract(feature.get(agc_field))).pow(2)});
  }).reduceColumns(ee.Reducer.sum(), ['agc_res2'])

  var agc_rms = (ee.Number(agc_res_ss.get('sum')).divide(agc_plots.size())).sqrt()
  print('agc_rms: ', agc_rms)

  // find mean agc 
  var agc_mean = ee.Number(agc_plots.reduceColumns(ee.Reducer.mean(), [agc_field]).get('mean'));
  print('agc_mean: ', agc_mean)
  
  // sum of squares
  var agc_ss = agc_plots.map(function(feature) {
    return feature.set({agc_off2: (ee.Number(feature.get(agc_field)).subtract(agc_mean)).pow(2)});
  }).reduceColumns(ee.Reducer.sum(), ['agc_off2'])
  
  var agc_r2 = ee.Number(1).subtract(ee.Number(agc_res_ss.get('sum')).divide(ee.Number(agc_ss.get('sum'))))
  print('agc_r2: ', agc_r2)
  
  
  // // find sum of squares
  // var agc_mean = ee.Number(agc_plots.reduceColumns(ee.Reducer.mean(), [agc_field]).get('mean'));
  // // print('agc_mean: ', agc_mean)
  
  // // sum of squares
  // var agc_ss = agc_plots.map(function(feature) {
  //   return feature.set({agc_off2: (ee.Number(feature.get('mean')).subtract(agc_mean)).pow(2)});
  // }).reduceColumns(ee.Reducer.sum(), ['agc_off2'])  
}


if (true)
  var s2_toa_images = ee.ImageCollection('COPERNICUS/S2')
                    .filterDate('2017-09-01', '2017-11-01')
                    // Pre-filter to get less cloudy granules.
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))  // CLOUDY_PIXEL_PERCENTAGE is in metadata (not a band)
                    // .filter(ee.Filter.lt('MEAN_SOLAR_ZENITH_ANGLE', 30))
                    // .filter(ee.Filter.lt('MEAN_INCIDENCE_ZENITH_ANGLE_B1', 20))
                    .filterBounds(step_arid_and_valley_thicket);
                    .map(cloud_masking.s2_simple_cloud_mask);

else if (false)
  var s2_sr_images = ee.ImageCollection('COPERNICUS/S2_SR')
                    .filterDate('2019-11-01', '2019-11-30')
                    // Pre-filter to get less cloudy granules.
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))  // CLOUDY_PIXEL_PERCENTAGE is in metadata (not a band)
                    // .filter(ee.Filter.lt('MEAN_SOLAR_ZENITH_ANGLE', 30))
                    // .filter(ee.Filter.lt('MEAN_INCIDENCE_ZENITH_ANGLE_B1', 30))
                    .filterBounds(step_arid_and_valley_thicket)
                    .map(cloud_masking.s2_simple_cloud_mask);

else if (false)
{
  var l8_sr_images = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR') //ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')  
                      .filterDate('2017-09-01', '2017-12-30')
                      .filterBounds(step_arid_and_valley_thicket)
                      .map(cloud_masking.landsat8_sr_cloud_mask);
  // gef_calib_plots = gef_calib_plots_l8_nir1;
}                     
else if (false)
  var l8_toa_images = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA') //ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')  
                      .filterDate('2017-11-01', '2017-12-30')
                      .filterBounds(step_arid_and_valley_thicket)
                      .map(cloud_masking.landsat8_toa_cloud_mask);
// else if (false)
//   var s2_toa_images = s2_cloud_masking.get_s2_sr_cld_col(step_arid_and_valley_thicket, '2017-10-01', '2017-10-30')
//                         .map(s2_cloud_masking.add_cld_only_mask)
//                         .map(s2_cloud_masking.apply_cld_shdw_mask);

// convert AgcHa from kg to tons
gef_sampling_plots = gef_sampling_plots.map(function(feature){return feature.set({AgcHa: ee.Number(feature.get('AgcHa')).divide(1000)})});

var images = s2_toa_images;
print('num images: ', images.size());
print('images metadata: ', images);
// print('image metadata: ', images.first());
print('SPACECRAFT_NAME: ', images.first().get('SPACECRAFT_NAME'));

var image = images.median();

var rn_image = find_rn(image);  //ee.String(images.first().get('SPACECRAFT_NAME'))
print('rn_image: ', rn_image);
var split = 0.5;  
var calib_plots = gef_calib_plots.randomColumn('random', 0);
var train_calib_plots = calib_plots.filter(ee.Filter.lt('random', split));
var test_calib_plots = calib_plots.filter(ee.Filter.gte('random', split));

var agc_image = model_agc(rn_image, train_calib_plots);

print('Calib Train Accuracy:');
accuracy_check(agc_image, train_calib_plots);
print('Calib Test Accuracy:');
accuracy_check(agc_image, test_calib_plots);
print('Sampling Accuracy:');
accuracy_check(agc_image, gef_sampling_plots);

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
var masked_image = image.clip(step_arid_and_valley_thicket.geometry())
Map.setOptions('TERRAIN');
Map.centerObject(step_arid_and_valley_thicket);
// Map.addLayer(masked_image.divide(10000), {min: 0.0, max: [0.3, 0.3, 0.3], bands: ['B4', 'B3', 'B2'], opacity: 1.0}, 'S2_SR');
Map.addLayer(masked_image, {min: 0.0, max: 3000, bands: ['B4', 'B3', 'B2'], opacity: 1.0}, 'RGB', false);
Map.addLayer(agc_masked_image, {min: 0, max: 40, palette: ['red', 'yellow', 'green'], opacity: 1.0}, 'AGC');