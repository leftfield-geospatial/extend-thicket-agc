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

// Adapted from https://developers.google.com/earth-engine/tutorials/community/sentinel-2-s2cloudless
// by Dugal Harris (dugalh@gmail.com) - Feb 2021

// Parameters for cloud and shadow masking with "s2cloudless" (cloud probability images)
var s2CloudMaskParams = {
  AOI: ee.Geometry.Point(24, -33.5),
  START_DATE: "2017-10-01",
  END_DATE: "2017-11-01",
  CLOUD_FILTER: 60,
  CLD_PRB_THRESH: 25,
  NIR_DRK_THRESH: 0.15,
  SR_BAND_SCALE: 1e4,
  CLD_PRJ_DIST: 4,
  BUFFER: 100,
};
exports.s2CloudMaskParams = s2CloudMaskParams;

function getS2SrCldCol(aoi, startDate, endDate) {
  // Import and filter S2 SR.
  var s2SrCol = ee
    .ImageCollection("COPERNICUS/S2")
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(
      ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", s2CloudMaskParams.CLOUD_FILTER)
    );

  // Import and filter s2cloudless.
  var s2CloudlessCol = ee
    .ImageCollection("COPERNICUS/S2_CLOUD_PROBABILITY")
    .filterBounds(aoi)
    .filterDate(startDate, endDate);

  // Join the filtered s2cloudless collection to the SR collection by the 'system:index' property.
  return ee.ImageCollection(
    ee.Join.saveFirst("s2cloudless").apply({
      primary: s2SrCol,
      secondary: s2CloudlessCol,
      condition: ee.Filter.equals({
        leftField: "system:index",
        rightField: "system:index",
      }),
    })
  );
}
exports.getS2SrCldCol = getS2SrCldCol;

function addCloudBands(img) {
  // Get s2cloudless image, subset the probability band.
  var cldPrb = ee.Image(img.get("s2cloudless")).select("probability");

  // Condition s2cloudless by the probability threshold value.
  var isCloud = cldPrb.gt(s2CloudMaskParams.CLD_PRB_THRESH).rename("clouds");

  // Add the cloud probability layer and cloud mask as image bands.
  return img.addBands(ee.Image([cldPrb, isCloud]));
}
exports.addCloudBands = addCloudBands;

function addShadowBands(img) {
  // Identify water pixels from the SCL band.
  var darkPixels;
  if ("SCL" in img.bandNames()) {
    var notWater = img.select("SCL").neq(6);

    // Identify dark NIR pixels that are not water (potential cloud shadow pixels)
    s2CloudMaskParams.SR_BAND_SCALE = 1e4;
    darkPixels = img
      .select("B8")
      .lt(s2CloudMaskParams.NIR_DRK_THRESH * s2CloudMaskParams.SR_BAND_SCALE)
      .multiply(notWater)
      .rename("darkPixels");
  } else {
    s2CloudMaskParams.SR_BAND_SCALE = 1e4;
    darkPixels = img
      .select("B8")
      .lt(s2CloudMaskParams.NIR_DRK_THRESH * s2CloudMaskParams.SR_BAND_SCALE)
      .rename("darkPixels");
  }

  // Determine the direction to project cloud shadow from clouds (assumes UTM projection).
  var shadowAzimuth = ee
    .Number(90)
    .subtract(ee.Number(img.get("MEAN_SOLAR_AZIMUTH_ANGLE")));

  // Project shadows from clouds for the distance specified by the CLD_PRJ_DIST input.
  var cldProj = img
    .select("clouds")
    .directionalDistanceTransform(
      shadowAzimuth,
      s2CloudMaskParams.CLD_PRJ_DIST * 10
    )
    .reproject({ crs: img.select(0).projection(), scale: 100 })
    .select("distance")
    .mask()
    .rename("cloudTransform");

  // Identify the intersection of dark pixels with cloud shadow projection.
  var shadows = cldProj.multiply(darkPixels).rename("shadows");

  // Add dark pixels, cloud projection, and identified shadows as image bands.
  return img.addBands(ee.Image([darkPixels, cldProj, shadows]));
}
exports.addShadowBands = addShadowBands;

function addCldShdwMask(img, scale) {
  if (scale === undefined || scale === null) {
    scale = 20;
  }

  // Add cloud component bands.
  var imgCloud = addCloudBands(img);

  // Add cloud shadow component bands.
  var img_cloud_shadow = addShadowBands(imgCloud);

  // Combine cloud and shadow mask, set cloud and shadow as value 1, else 0.
  var isCldShdw = img_cloud_shadow
    .select("clouds")
    .add(img_cloud_shadow.select("shadows"))
    .gt(0);

  // Remove small cloud-shadow patches and dilate remaining pixels by BUFFER input.
  // 20 m scale is for speed, and assumes clouds don't require 10 m precision.
  isCldShdw = isCldShdw
    .focal_min(2)
    .focal_max((s2CloudMaskParams.BUFFER * 2) / 20)
    .reproject({ crs: img.select([0]).projection(), scale: 20 })
    .rename("cloudMask");

  // Add the final cloud-shadow mask to the image.
  return img_cloud_shadow.addBands(isCldShdw);
}
exports.addCldShdwMask = addCldShdwMask;

function addCldOnlyMask(img, scale) {
  if (scale === undefined || scale === null) {
    scale = 20;
  }
  // Add cloud component bands.
  var imgCloud = addCloudBands(img);

  // Dilate the s2cloudless mask
  var isCldShdw = imgCloud
    .select("clouds")
    .focal_max((s2CloudMaskParams.BUFFER * 2) / scale)
    .rename("cloudMask");

  return imgCloud.addBands(isCldShdw);
}
exports.addCldOnlyMask = addCldOnlyMask;

function applyCldShdwMask(img) {
  // Subset the cloudMask band and invert it so clouds/shadow are 0, else 1.
  var notCldShdw = img.select("cloudMask").not();

  // Subset reflectance bands and update their masks, return the result.
  return img.updateMask(notCldShdw);
}
exports.applyCldShdwMask = applyCldShdwMask;

function displayCloudLayers(col) {
  // Mosaic the image collection.
  var img = col.mosaic();

  // Subset layers and prepare them for display.
  var clouds = img.select("clouds").selfMask();
  var shadows = img.select("shadows").selfMask();
  var darkPixels = img.select("darkPixels").selfMask();
  var probability = img.select("probability");
  var cloudMask = img.select("cloudMask").selfMask();
  var cloudTransform = img.select("cloudTransform");

  Map.centerObject(s2CloudMaskParams.AOI);

  // Add layers to the map.
  Map.addLayer(
    img,
    { bands: ["B4", "B3", "B2"], min: 0, max: 2500, gamma: 1.1 },
    "S2 image",
    true
  );
  Map.addLayer(probability, { min: 0, max: 100 }, "probability (cloud)", false);
  Map.addLayer(clouds, { palette: "e056fd" }, "clouds", false);
  Map.addLayer(
    cloudTransform,
    { min: 0, max: 1, palette: ["white", "black"] },
    "cloudTransform",
    false
  );
  Map.addLayer(darkPixels, { palette: "orange" }, "darkPixels", false);
  Map.addLayer(shadows, { palette: "yellow" }, "shadows", false);
  Map.addLayer(cloudMask, { palette: "orange" }, "cloudMask", true);
  return;
}
exports.displayCloudLayers = displayCloudLayers;
