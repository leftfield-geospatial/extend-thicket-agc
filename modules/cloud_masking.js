// Functions for cloud and shadow masking Sentinel-2 and Landsat 8 imagery

// Simple Sentinel-2 cloud masking using QA60 band
function s2_simple_cloud_mask(image) 
{
  var qa = image.select('QA60');
  var bitMask = (1 << 11) | (1 << 10);
  return image.updateMask(qa.bitwiseAnd(bitMask).eq(0).focal_min(10));
}
exports.s2_simple_cloud_mask = s2_simple_cloud_mask;

// Mask with the GEE simpleCloudScore function
function landsat_simple_cloud_mask(image)
{
  var scored = ee.Algorithms.Landsat.simpleCloudScore(image);
  
  // Create a mask from the cloud score and combine it with the image mask.
  var mask = scored.select(['cloud']).lte(5);
  
  // Apply the mask to the image and display the result.
  return image.updateMask(mask);
}

function landsat8_sr_cloud_mask(image) 
{
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  // var could_shadow_bit = (1 << 3);
  // var cloud_bit = (1 << 5);
  var mask_bit = (1 << 5) | (1 << 3);
  // Get the pixel QA band.
  var qa = image.select('pixel_qa');
  // Both flags should be set to zero, indicating clear conditions.
  // var mask = qa.bitwiseAnd(could_shadow_bit).eq(0)
  //               .and(qa.bitwiseAnd(cloud_bit).eq(0));
  // return image.updateMask(mask);
  return image.updateMask(qa.bitwiseAnd(mask_bit).eq(0));
}

function landsat8_toa_cloud_mask(image) 
{
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  // var could_shadow_bit = (1 << 3);
  // var cloud_bit = (1 << 4);
  var bit_mask = (1 << 4) | (1 << 8);    // cloud bit and upper bit of shadow confidence
  // Get the pixel QA band.
  var qa = image.select('BQA');
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(bit_mask).eq(0);
  return image.updateMask(mask);
}