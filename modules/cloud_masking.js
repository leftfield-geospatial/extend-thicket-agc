// Straightforward Sentinel-2 cloud masking using QA60 band
function s2_cloud_mask(image) 
{
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  // var cloudBitMask = 1 << 10;
  // var cirrusBitMask = 1 << 11;
  var bitMask = (1 << 11) | (1 << 10);

  // Both flags should be set to zero, indicating clear conditions.
  // var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(qa.bitwiseAnd(bitMask).eq(0).focal_min(10));
  // return image.updateMask(mask);
}
exports.s2_cloud_mask_params = s2_cloud_mask_params;