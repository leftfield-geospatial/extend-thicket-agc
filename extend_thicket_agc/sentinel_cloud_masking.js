export s2CloudMaskParams = { 
    AOI: ee.Geometry.Point(24, -33.5),
    START_DATE: '2017-10-01',
    END_DATE: '2017-11-01',
    CLOUD_FILTER: 60,
    CLD_PRB_THRESH: 25,
    NIR_DRK_THRESH: 0.15,
    CLD_PRJ_DIST: 4,
    BUFFER: 100
};

export function get_s2_sr_cld_col(aoi, start_date, end_date)
{
    // Import and filter S2 SR.
    s2_sr_col = (ee.ImageCollection('COPERNICUS/S2')
        .filterBounds(aoi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', s2CloudMaskParams['CLOUD_FILTER'])));

    // Import and filter s2cloudless.
    s2_cloudless_col = (ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
        .filterBounds(aoi)
        .filterDate(start_date, end_date))

    # Join the filtered s2cloudless collection to the SR collection by the 'system:index' property.
    return ee.ImageCollection(ee.Join.saveFirst('s2cloudless').apply(**{
        'primary': s2_sr_col,
        'secondary': s2_cloudless_col,
        'condition': ee.Filter.equals(**{
            'leftField': 'system:index',
            'rightField': 'system:index'
        })
    }))
}

export function draw(ctx, length, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, length, length);

  return {
    length: length,
    x: x,
    y: y,
    color: color
  };