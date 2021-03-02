/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var step_arid_and_valley_thicket = ee.FeatureCollection("users/dugalh/extend_thicket_agc/step_arid_and_valley_thicket");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// Calibrate the GEF AGC model to Landsat / Sentinel imagery and evaluate accuracy 

// Find Sentinel or Landsat normalised red image
function find_rn(image) {
  var rn_image = ee.Algorithms.If(image.bandNames().contains('B8'), 
            image.expression('(R / (R + G + B + RE))', 
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


var cloud_masking = require('users/dugalh/extend_thicket_agc:modules/cloud_masking.js');
var thicket_boundary = step_arid_and_valley_thicket;

// the univariate log(mean(R/pan)) WV3 model with pan = (R + G + B + RE) from https://github.com/dugalh/map_thicket_agc
var gef_agc_model = {m: ee.Number(-318.8304), c: ee.Number(25.7259)};
// var agc_model = {m: ee.Number(-252.1986), c: ee.Number(16.9453)};  // pan = (R + G + B + NIR1)
// var agc_model = {m: ee.Number(-245.6729), c: ee.Number(11.5778)};  // pan = (R + G + B + NIR1)

print(agc_model);


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

  var calib_res = ee.Dictionary(log_rn_plots.reduceColumns({
    reducer: ee.Reducer.linearRegression({
      numX: 2,
      numY: 1
    }),
    selectors: ['extend_log_rn', 'constant', 'log(mean(R/pan))']
  }));
  print('calib_res: ', calib_res);
  
  var calib_coeff = ee.Array(calib_res.get('coefficients')).toList();
  // print(calib_model.get('coefficients'))
  //should these be made server side?
  var calib_model = {m: ee.Number(ee.List(calib_coeff.get(0)).get(0)), c: ee.Number(ee.List(calib_coeff.get(1)).get(0))};
  var agc_ee_model = {m: calib_model.m.multiply(agc_model.m), c: calib_model.c.multiply(agc_model.m).add(agc_model.c)};
  
  // apply calibration transform and AGC model in one step
  // var agc_image = rn_image.log10().multiply(calib_model.m.multiply(agc_model.m)).add(calib_model.c.multiply(agc_model.m).add(agc_model.c));
  var agc_image = rn_image.log10().multiply(agc_ee_model.m).add(agc_ee_model.c);
  
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
  }).reduceColumns(ee.Reducer.sum(), ['agc_res2']);

  var agc_rms = (ee.Number(agc_res_ss.get('sum')).divide(agc_plots.size())).sqrt();
  print('agc_rms: ', agc_rms);

  // find mean agc 
  var agc_mean = ee.Number(agc_plots.reduceColumns(ee.Reducer.mean(), [agc_field]).get('mean'));
  print('agc_mean: ', agc_mean);
  
  // sum of squares
  var agc_ss = agc_plots.map(function(feature) {
    return feature.set({agc_off2: (ee.Number(feature.get(agc_field)).subtract(agc_mean)).pow(2)});
  }).reduceColumns(ee.Reducer.sum(), ['agc_off2']);
  
  var agc_r2 = ee.Number(1).subtract(ee.Number(agc_res_ss.get('sum')).divide(ee.Number(agc_ss.get('sum'))));
  print('agc_r2: ', agc_r2);
  
  
  // // find sum of squares
  // var agc_mean = ee.Number(agc_plots.reduceColumns(ee.Reducer.mean(), [agc_field]).get('mean'));
  // // print('agc_mean: ', agc_mean)
  
  // // sum of squares
  // var agc_ss = agc_plots.map(function(feature) {
  //   return feature.set({agc_off2: (ee.Number(feature.get('mean')).subtract(agc_mean)).pow(2)});
  // }).reduceColumns(ee.Reducer.sum(), ['agc_off2'])  
}


if (false)
  var s2_toa_images = ee.ImageCollection('COPERNICUS/S2')
                    .filterDate('2017-09-01', '2017-11-01')
                    // Pre-filter to get less cloudy granules.
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))  // CLOUDY_PIXEL_PERCENTAGE is in metadata (not a band)
                    // .filter(ee.Filter.lt('MEAN_SOLAR_ZENITH_ANGLE', 30))
                    // .filter(ee.Filter.lt('MEAN_INCIDENCE_ZENITH_ANGLE_B1', 20))
                    .filterBounds(thicket_boundary)
                    .map(cloud_masking.s2_simple_cloud_mask);

else if (false)
  var s2_sr_images = ee.ImageCollection('COPERNICUS/S2_SR')
                    .filterDate('2019-11-01', '2019-11-30')
                    // Pre-filter to get less cloudy granules.
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))  // CLOUDY_PIXEL_PERCENTAGE is in metadata (not a band)
                    // .filter(ee.Filter.lt('MEAN_SOLAR_ZENITH_ANGLE', 30))
                    // .filter(ee.Filter.lt('MEAN_INCIDENCE_ZENITH_ANGLE_B1', 30))
                    .filterBounds(thicket_boundary)
                    .map(cloud_masking.s2_simple_cloud_mask);

else if (true)
{
  var l8_sr_images = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR') //ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')  
                      .filterDate('2017-09-01', '2017-12-30')
                      .filterBounds(thicket_boundary)
                      .map(cloud_masking.landsat8_sr_cloud_mask);
  // gef_calib_plots = gef_calib_plots_l8_nir1;
}
else if (false)
  var l8_toa_images = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA') //ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')  
                      .filterDate('2017-11-01', '2017-12-30')
                      .filterBounds(thicket_boundary)
                      .map(cloud_masking.landsat8_toa_cloud_mask);
// else if (false)
//   var s2_toa_images = s2_cloud_masking.get_s2_sr_cld_col(thicket_boundary, '2017-10-01', '2017-10-30')
//                         .map(s2_cloud_masking.add_cld_only_mask)
//                         .map(s2_cloud_masking.apply_cld_shdw_mask);

// convert AgcHa from kg to tons
gef_sampling_plots = gef_sampling_plots.map(function(feature){return feature.set({AgcHa: ee.Number(feature.get('AgcHa')).divide(1000)})});

var images = l8_sr_images;
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
    geometry: thicket_boundary,
    scale: 100,
    maxPixels: 1e8
  });
  
  print('min_agc: ', min_agc)
  
  var max_agc = agc_image.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: thicket_boundary,
    scale: 100,
    maxPixels: 1e8
  });
  print('max_agc: ', max_agc)

  var p_agc = agc_image.reduceRegion({
    reducer: ee.Reducer.percentile([2,5,95,98]),
    geometry: thicket_boundary,
    scale: 100,
    maxPixels: 1e8
  });
  print('5-95% AGC: ', p_agc)
}
