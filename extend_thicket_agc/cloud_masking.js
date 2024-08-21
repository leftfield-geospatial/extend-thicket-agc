/*
    Functions for cloud and shadow masking Sentinel-2 and Landsat 8 imagery
    Copyright (C) 2021 Dugal Harris
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

// Cloud and shadow mask L8 SR data (collection 2) with "QA_PIXEL" band
function landsat8SrCloudMask(image) 
{
  // var maskBit = (1 << 4) | (1 << 3) | (1 << 2);
  // var qa = image.select('(?i)(pixel_qa|qa_pixel)');
  // return image.updateMask(qa.bitwiseAnd(maskBit).eq(0));
  // from https://developers.google.com/earth-engine/landsat_c1_to_c2#surface_reflectance
  var mask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  return image.updateMask(mask);
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