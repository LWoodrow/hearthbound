// Bitmap enlargement cannot manufacture additional source detail. The same
// bound applies to every illustrated local atlas, including legacy crops.
export function atlasZoomLimit({sourceWidth,viewportWidth,pixelRatio=1,cropScale=1,maximum=3}) {
  if(!Number.isFinite(sourceWidth)||sourceWidth<=0||!Number.isFinite(viewportWidth)||viewportWidth<=0) return 1;
  const density=Number.isFinite(pixelRatio)&&pixelRatio>0?pixelRatio:1;
  const crop=Number.isFinite(cropScale)&&cropScale>0?cropScale:1;
  return Math.max(1,Math.min(maximum,Math.floor(sourceWidth/(viewportWidth*density*crop)*4)/4));
}
