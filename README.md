# Extended aboveground carbon (AGC) mapping in thicket
[A localised AGC model using WorldView-3 imagery](https://github.com/dugalh/map_thicket_agc) is calibrated to coarser resolution Landsat 8 imagery and applied to the thicket biome (South Africa) using Google Earth Engine.  This is a concept demonstration - AGC accuracy is not known outside the [WorldView-3 model study area](https://github.com/dugalh/map_thicket_agc#ground-truth).   


## Getting Started
* Map visualisation is available [here](https://dugalh.users.earthengine.app/view/thicket-aboveground-carbon) as a Google Earth Engine App.  Give it a minute to generate the AGC estimates.  
* Users registered with Google Earth Engine can access the repository and run the scripts [here](https://code.earthengine.google.com/?accept_repo=users/dugalh/extend_thicket_agc).  

### Data
File | Description
---|---
[data/inputs/geospatial/gef_calib_plots.geojson](data/inputs/geospatial/gef_calib_plots.geojson) | AGC estimates (ground truth) for plots in the GEF-5 SLM study area.
[data/inputs/geospatial/step_arid_and_valley_thicket.zip](data/inputs/geospatial/step_arid_and_valley_thicket.zip) | Boundaries of combined arid and valley thicket types.

### Generating Results
Script | Description
------ | -----------
[scripts/calibrate_agc_model.js](scripts/calibrate_agc_model.js) | Calibrate the WorldView-3 AGC model to Landsat 8 imagery and evaluate.  
[scripts/generate_agc_map_ui.js](scripts/generate_agc_map_ui.js) | Apply the calibrated AGC model to the biome and visualise the results.

## Summary of Results

The calibrated Landsat 8 AGC model produced a RMSE of 3.35 tC/ha, and an *R*<sup>2</sup> of 0.93, on 20 ground truth plots in the [GEF-5 SLM study area](https://github.com/dugalh/map_thicket_agc#ground-truth).  Arid and valley thicket types cover 3.65 million ha, with an average AGC of 20.57 tC/ha.  Further ground truth and modelling work is required to establish AGC accuracy across the biome.  

A screenshot of the [visualisation app](https://dugalh.users.earthengine.app/view/thicket-aboveground-carbon) is shown below.


<img src="data/outputs/plots/eg_gee_agc_map.jpg" data-canonical-src="data/outputs/plots/eg_gee_agc_map.png" alt="Thicket AGC" width="800"/>


## License
- Code is licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html)
- Data is licensed under the [CC-BY-SA](https://creativecommons.org/licenses/by-sa/4.0)

## Citation
For use of the code or map, please cite:
- Dugal Harris, Cosman Bolus, James Reeler, "Very high resolution aboveground carbon mapping in subtropical thicket," *Journal of Applied Remote Sensing*. **15**(3), 038502 (2021), [doi: 10.1117/1.JRS.15.038502](http://dx.doi.org/10.1117/1.JRS.15.038502)

## Author
* **Dugal Harris** - [dugalh@gmail.com](mailto:dugalh@gmail.com)

## Acknowledgements
* Thicket boundaries were derived from the [STEP vegetation map](https://bgis.sanbi.org/STEP/project.asp). 
* The [WorldView-3 AGC model](https://github.com/dugalh/map_thicket_agc) was produced as part of the [GEF-5 SLM project](https://www.thegef.org/project/securing-multiple-ecosystems-benefit-through-slm-productive-degraded-landscapes-south-africa).  
