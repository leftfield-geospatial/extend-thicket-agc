// Functions for cloud and shadow masking Sentinel-2 and Landsat 8 imagery

// Simple Sentinel-2 cloud masking using QA60 band
function s2_simple_cloud_mask(image) 
{
  var qa = image.select('QA60');
  var bitMask = (1 << 11) | (1 << 10);
  return image.updateMask(qa.bitwiseAnd(bitMask).eq(0).focal_min(10));
}
exports.s2_simple_cloud_mask = s2_simple_cloud_mask;

// s2cloudless cloud prob masking - assimes image is join of S2 TOA/SR and s2cloudless
function s2_prob_cloud_mask(image, thresh=20)
{
  var cld_prb = ee.Image(image.get('s2cloudless')).select('probability');
  return image.updateMask(cld_prb.lt(thresh));
}
exports.s2_prob_cloud_mask = s2_prob_cloud_mask;

// Cloud mask Landsatr with the GEE simpleCloudScore function
function landsat_simple_cloud_mask(image, thresh=5)
{
  var scored = ee.Algorithms.Landsat.simpleCloudScore(image);
  var mask = scored.select(['cloud']).lte(thresh);
  return image.updateMask(mask);
}
exports.landsat_simple_cloud_mask = landsat_simple_cloud_mask;

// Cloud and shadow mask L8 SR data with "pixel_qa" band
function landsat8_sr_cloud_mask(image) 
{
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  var mask_bit = (1 << 5) | (1 << 3);
  var qa = image.select('pixel_qa');
  return image.updateMask(qa.bitwiseAnd(mask_bit).eq(0));
}
exports.landsat8_sr_cloud_mask = landsat8_sr_cloud_mask;

// Cloud and shadow mask L8 TOA data with "BQA" band
function landsat8_toa_cloud_mask(image) 
{
  var bit_mask = (1 << 4) | (1 << 8);    // cloud bit and upper bit of shadow confidence
  var qa = image.select('BQA');
  return image.updateMask(qa.bitwiseAnd(bit_mask).eq(0));
}
exports.landsat8_toa_cloud_mask = landsat8_toa_cloud_mask;