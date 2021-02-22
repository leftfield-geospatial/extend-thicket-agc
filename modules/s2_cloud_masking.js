/* @title Copyright 2020 The Earth Engine Community Authors { display-mode: "form" }

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at
  
   https://www.apache.org/licenses/LICENSE-2.0
  
   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.*/

exports.s2CloudMaskParams = { 
    AOI: ee.Geometry.Point(24, -33.5),
    START_DATE: '2017-10-01',
    END_DATE: '2017-11-01',
    CLOUD_FILTER: 60,
    CLD_PRB_THRESH: 25,
    NIR_DRK_THRESH: 0.15,
    SR_BAND_SCALE: 1e4,
    CLD_PRJ_DIST: 4,
    BUFFER: 100,
};

exports.get_s2_sr_cld_col = function(aoi, start_date, end_date)
{
    // Import and filter S2 SR.
    s2_sr_col = (ee.ImageCollection('COPERNICUS/S2')
        .filterBounds(aoi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', s2CloudMaskParams['CLOUD_FILTER'])));

    // Import and filter s2cloudless.
    s2_cloudless_col = (ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
        .filterBounds(aoi)
        .filterDate(start_date, end_date));

    // Join the filtered s2cloudless collection to the SR collection by the 'system:index' property.
    return ee.ImageCollection(ee.Join.saveFirst('s2cloudless').apply({
        'primary': s2_sr_col,
        'secondary': s2_cloudless_col,
        'condition': ee.Filter.equals({
            'leftField': 'system:index',
            'rightField': 'system:index'
        })
    }));
}

exports.add_cloud_bands = function(img)
{
  // Get s2cloudless image, subset the probability band.
  var cld_prb = ee.Image(img.get('s2cloudless')).select('probability');
  
  // Condition s2cloudless by the probability threshold value.
  var is_cloud = cld_prb.gt(CLD_PRB_THRESH).rename('clouds');
  
  // Add the cloud probability layer and cloud mask as image bands.
  return img.addBands(ee.Image([cld_prb, is_cloud]));
}


exports.add_shadow_bands = function(img)
{
  // Identify water pixels from the SCL band.
  var dark_pixels
  if (false)
  {
      var not_water = img.select('SCL').neq(6);
  
      // Identify dark NIR pixels that are not water (potential cloud shadow pixels)
      s2CloudMaskParams.SR_BAND_SCALE = 1e4;
      dark_pixels = img.select('B8').lt(s2CloudMaskParams.NIR_DRK_THRESH*SR_BAND_SCALE).multiply(not_water).rename('dark_pixels');
  }
  else
  {
      s2CloudMaskParams.SR_BAND_SCALE = 1e4;
      dark_pixels = img.select('B8').lt(s2CloudMaskParams.NIR_DRK_THRESH*SR_BAND_SCALE).rename('dark_pixels');
  }

  // Determine the direction to project cloud shadow from clouds (assumes UTM projection).
  var shadow_azimuth = ee.Number(90).subtract(ee.Number(img.get('MEAN_SOLAR_AZIMUTH_ANGLE')));
  
  // Project shadows from clouds for the distance specified by the CLD_PRJ_DIST input.
  cld_proj = (img.select('clouds').directionalDistanceTransform(shadow_azimuth, CLD_PRJ_DIST*10)
      .reproject(**{'crs': img.select(0).projection(), 'scale': 100})
      .select('distance')
      .mask()
      .rename('cloud_transform'))
  
  // Identify the intersection of dark pixels with cloud shadow projection.
  shadows = cld_proj.multiply(dark_pixels).rename('shadows')
  
  // Add dark pixels, cloud projection, and identified shadows as image bands.
  return img.addBands(ee.Image([dark_pixels, cld_proj, shadows]))
}

def add_cld_shdw_mask(img):
    # Add cloud component bands.
    img_cloud = add_cloud_bands(img)

    # Add cloud shadow component bands.
    img_cloud_shadow = add_shadow_bands(img_cloud)

    # Combine cloud and shadow mask, set cloud and shadow as value 1, else 0.
    is_cld_shdw = img_cloud_shadow.select('clouds').add(img_cloud_shadow.select('shadows')).gt(0)

    # Remove small cloud-shadow patches and dilate remaining pixels by BUFFER input.
    # 20 m scale is for speed, and assumes clouds don't require 10 m precision.
    is_cld_shdw = (is_cld_shdw.focal_min(2).focal_max(BUFFER*2/20)
        .reproject(**{'crs': img.select([0]).projection(), 'scale': 20})
        .rename('cloudmask'))

    # Add the final cloud-shadow mask to the image.
    return img_cloud_shadow.addBands(is_cld_shdw)