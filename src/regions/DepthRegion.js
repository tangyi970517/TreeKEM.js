export
const makeDepthRegion = (DepthMax = 0) => {
	return (
		///
///
class DepthRegion {
	constructor() {
		this.depths = new WeakMap();
	}

	getDepth(leaf) {
		return this.depths.get(leaf) ?? DepthMax;
	}
	setDepth(leaf, depth) {
		return this.depths.set(leaf, Math.min(depth, DepthMax));
	}

	isInRegion(node, leaf, epoch, _root, path = new Set(leaf.getPath(epoch))) {
		let d = this.getDepth(leaf);
		for (const ancestor of node.getPath(epoch, false)) {
			if (d <= 0) {
				break;
			}
			--d;
			if (path.has(ancestor)) {
				return true;
			}
		}
		return false;
	}
}
///
		///
	);
};

export default makeDepthRegion();
