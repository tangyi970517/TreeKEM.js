export * from './PathRegion.js';
export * from './FullRegion.js';
export * from './DepthRegion.js';

import PathRegion from './PathRegion.js';
import FullRegion from './FullRegion.js';
import {makeDepthRegion} from './DepthRegion.js';

export
const RegionTypes = new Map();

RegionTypes.set('path', PathRegion);

RegionTypes.set('full', FullRegion);

for (const d of [1, 2, 3, 5]) {
	RegionTypes.set(`depth=${d}`, makeDepthRegion(d));
}
RegionTypes.set(`path:depth=${0}`, makeDepthRegion(0));
RegionTypes.set(`full:depth=${Infinity}`, makeDepthRegion(Infinity));
