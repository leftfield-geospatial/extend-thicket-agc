# Extension of aboveground carbon (AGC) estimation to the thicket biome
A concept demonstration for extension of a local AGC model to the thicket biome in South Africa, using [Google Earth Engine](https://earthengine.google.com/). 

A model for estimating AGC from WorldView-3 imagery was developed for a small area in the Baviaanskloof, as part of the [GEF-5 SLM](https://www.thegef.org/project/securing-multiple-ecosystems-benefit-through-slm-productive-degraded-landscapes-south-africa) project.  Here this model is re-calibrated to coarser resolution Landsat 8 data and applied to the biome.  See the [GitHub repository](https://github.com/dugalh/map_thicket_agc) for more detail on the WorldView-3 model. 

The biome AGC map is intended as a demonstration of the multi-resolution approach applied to thicket.  AGC accuracy outside of the GEF-5 SLM study area has not been established. Further ground truthing and modelling work would be required to demonstrate AGC accuracy across the biome. 

## Getting Started
Users with a Google Earth Engine Account can run the code [here](https://code.earthengine.google.com/?accept_repo=users/dugalh/extend_thicket_agc).  Alternatively the map is available to anyone as a Google Earth Engine app [here]().

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

## License
- Code is licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html)
- Data is licensed under the [CC-BY-SA](https://creativecommons.org/licenses/by-sa/4.0)

## Citation
For use of the code or map, please cite: 
- Harris, D., Bolus, C., Reeler, J. 2019. [*Development of a method for remote sensing of aboveground carbon in subtropical thicket*](https://www.researchgate.net/publication/349060473_Remote_sensing_of_aboveground_carbon_in_subtropical_thicket), GEF-5 SLM, Rhodes University. Internal report.

## Author
* **Dugal Harris** - [dugalh@gmail.com](mailto:dugalh@gmail.com)

## Acknowledgements
* Thicket boundaries were derived from the [STEP vegetation map](https://bgis.sanbi.org/STEP/project.asp). 
* WorldView-3 AGC model was produced as part of the [GEF-5 SLM project](https://github.com/dugalh/map_thicket_agc).  
