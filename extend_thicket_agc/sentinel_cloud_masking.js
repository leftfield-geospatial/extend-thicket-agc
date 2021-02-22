export sentinelCloudMaskParams = { 
AOI: ee.Geometry.Point(24, -33.5)
START_DATE = '2017-10-01'
END_DATE = '2017-11-01'
CLOUD_FILTER = 60
CLD_PRB_THRESH = 25
NIR_DRK_THRESH = 0.15
CLD_PRJ_DIST = 4
BUFFER = 100}
export function draw(ctx, length, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, length, length);

  return {
    length: length,
    x: x,
    y: y,
    color: color
  };