"""
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
"""
import ee
import numpy as np
import matplotlib.pyplot as pyplot
import geopandas as gpd

ee.Initialize()

model_m = ee.Number(-318.8304)
model_c = ee.Number(25.7259)

def mask_s2_clouds(image):
    qa = image.select('QA60')

    # Bits 10 and 11 are clouds and cirrus, respectively.
    cloudBitMask = 1 << 10
    cirrusBitMask = 1 << 11

    # Both flags should be set to zero, indicating clear conditions.
    mask = qa.bitwiseAnd(cloudBitMask).eq(0)and(qa.bitwiseAnd(cirrusBitMask).eq(0))
    return image.updateMask(mask)

# var s2_dataset = ee.ImageCollection('COPERNICUS/S2_SR')    # not available for 2017
step_arid_and_valley_thicket = ee.FeatureCollection('https://code.earthengine.google.com/?asset=users/dugalh/step_arid_and_valley_thicket')
s2_images = ee.ImageCollection('COPERNICUS/S2').filterDate('2017-09-01', '2017-11-30').filter(
    ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5)).map(mask_s2_clouds).filterBounds(step_arid_and_valley_thicket)


print(s2_images.count())