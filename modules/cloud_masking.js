// Functions for cloud and shadow masking Sentinel-2 and Landsat 8 imagery
exports.defaultCloudThresh = 10

// Simple Sentinel-2 cloud masking using QA60 band
function s2SimpleCloudMask(image) 
{
  var qa = image.select('QA60');
  var bitMask = (1 << 11) | (1 << 10);
  return image.updateMask(qa.bitwiseAnd(bitMask).eq(0).focal_min(10));
}
exports.s2SimpleCloudMask = s2SimpleCloudMask;

// s2cloudless cloud prob masking 
// image - join of S2 TOA/SR and s2cloudless
function s2ProbCloudMask(image, thresh)
{
  if (thresh === undefined || thresh === null)
  {
    thresh = exports.defaultCloudThresh;
  }
  var cloudProb = ee.Image(image.get('s2cloudless')).select('probability');
  var cloudMask = cloudProb.lt(thresh);
  return image.updateMask(cloudMask);
}
exports.s2ProbCloudMask = s2ProbCloudMask;

// Cloud mask Landsatr with the GEE simpleCloudScore function
function landsatSimpleCloudMask(image, thresh)
{
  if (thresh === undefined || thresh === null)
  {
    thresh = exports.defaultCloudThresh;
  }
  var scored = ee.Algorithms.Landsat.simpleCloudScore(image);
  var mask = scored.select(['cloud']).lte(thresh);
  return image.updateMask(mask);
}
exports.landsatSimpleCloudMask = landsatSimpleCloudMask;

// Cloud and shadow mask L8 SR data with "pixel_qa" band
function landsat8SrCloudMask(image) 
{
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  var maskBit = (1 << 5) | (1 << 3);
  var qa = image.select('pixel_qa');
  return image.updateMask(qa.bitwiseAnd(maskBit).eq(0));
}
exports.landsat8SrCloudMask = landsat8SrCloudMask;

// Cloud and shadow mask L8 TOA data with "BQA" band
function landsat8ToaCloudMask(image) 
{
  var bitMask = (1 << 4) | (1 << 8);    // cloud bit and upper bit of shadow confidence
  var qa = image.select('BQA');
  return image.updateMask(qa.bitwiseAnd(bitMask).eq(0));
}
exports.landsat8ToaCloudMask = landsat8ToaCloudMask;