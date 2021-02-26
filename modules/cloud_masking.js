// Simple Sentinel-2 cloud masking using QA60 band
function s2_simple_cloud_mask(image) 
{
  var qa = image.select('QA60');
  var bitMask = (1 << 11) | (1 << 10);
  return image.updateMask(qa.bitwiseAnd(bitMask).eq(0).focal_min(10));
}
exports.s2_simple_cloud_mask = s2_simple_cloud_mask;

