# Aboveground carbon (AGC) estimation in the thicket biome
A concept demonstration for extension of local AGC model(s) to the thicket biome in South Africa using [Google Earth Engine](https://earthengine.google.com/). 

A model for estimating AGC from high resolution multi-spectral WorldView-3 imagery was developed for a small area in the Baviaanskloof as part of the [GEF-5 SLM](https://www.thegef.org/project/securing-multiple-ecosystems-benefit-through-slm-productive-degraded-landscapes-south-africa) project (see the [GitHub repository](https://github.com/dugalh/map_thicket_agc) for more details).  Here this model is re-calibrated to coarser resolution Landsat-8 multi-spectral data and applied to the biome.

The map is intended as a demonstration of the multi-resolution approach applied to thicket, and as an exploration of the possibilities of Google Earth Engine.  AGC accuracy outside of the GEF-5 SLM study area has not been established. Further ground truthing and modelling work would be required to demonstrate AGC accuracy across the biome. 

## Getting Started
The code runs as a Google Earth Engine app .  Give it a couple of minutes to calculate the results.

### Data
AGC estimates for plots in the GEF-5 SLM study area are contained in [data/inputs/geospatial/gef_calib_plots.geojson](data/inputs/geospatial/gef_calib_plots.geojson).  These are used in [scripts/calibrate_agc_model.js](scripts/calibrate_agc_model.js) for calibrating and evaluating the AGC model.   

### Generating Results
Script | Description
------ | -----------
[scripts/calibrate_agc_model.js](scripts/calibrate_agc_model.js) | Calibrate and evaluate the AGC model.  
[scripts/generate_agc_map_ui.js](scripts/generate_agc_map_ui.js) | Generate the thicket biome map.

## License
[AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html)

## Citation
For use of the code or map, please cite: 
- Harris, D., Bolus, C., Reeler, J. 2019. [*Development of a method for remote sensing of aboveground carbon in subtropical thicket*](https://www.researchgate.net/publication/349060473_Remote_sensing_of_aboveground_carbon_in_subtropical_thicket), GEF-5 SLM, Rhodes University. Internal report.

## Author
* **Dugal Harris** - [dugalh@gmail.com](mailto:dugalh@gmail.com)

## Acknowledgements
* Thicket boundaries were derived from the [STEP Vegetation map](https://bgis.sanbi.org/STEP/project.asp). 
* The original WorldView-3 AGC model was produced as part of the [GEF-5 SLM project](https://github.com/dugalh/map_thicket_agc)  
