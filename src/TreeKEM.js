import {assert, sum} from './utils.js';

const processSkeleton = (root, epoch, skeletonExtra, region, counts) => {
    for (const [node, childTrace] of skeletonGen(root, epoch, skeletonExtra, region, counts)) {
        assert(!node.isLeaf);
        assert(childTrace === null || node.children.indexOf(childTrace) >= 0);
        for (const child of node.children) {
            if (node === childTrace) {
                continue;
            }
            skeletonEnc(child, counts);
        }
    }
    assert(skeletonExtra.size === 0);
};

const isSkeleton = (node, epoch, skeletonExtra) => node.epoch === epoch || skeletonExtra.has(node);

const skeletonGen = function * (root, epoch, skeletonExtra, region, counts) {
    assert(isSkeleton(root, epoch, skeletonExtra));
    skeletonExtra.delete(root);
    if (root.isAllRemoved) {
        return;
    }
    if (root.isLeaf) {
        assert(root.data.secret);
        return;
    }
    const isInRegion = region.has(root);
    const isInSkeleton = root.children.map(child => isSkeleton(child, epoch, skeletonExtra));
    /**
     *
     * choose trace for PRG:
     * - must be in skeleton and in region
     * - choose `childTrace` if valid
     * - otherwise choose, e.g., first valid
     *
     */
    let firstInSkeletonCapRegion = null
    let childTrace = null;
    for (const [i, child] of root.children.entries()) {
        if (!(isInSkeleton[i] && region.has(child))) {
            continue;
        }
        if (firstInSkeletonCapRegion === null) {
            firstInSkeletonCapRegion = child;
        }
        if (child === root.childTrace) {
            childTrace = child;
        }
    }
    if (childTrace === null) {
        childTrace = firstInSkeletonCapRegion;
    }
    let seedTrace = null;
    for (const [i, child] of root.children.entries()) {
        if (!isInSkeleton[i]) {
            continue;
        }
        const seed = yield * skeletonGen(child, epoch, skeletonExtra, region, counts);
        if (child === childTrace) {
            seedTrace = seed;
        }
    }
    root.data.secret = null;
    if (isInRegion) {
        if (seedTrace) {
            ++counts.PRG;
        } else {
            ++counts.random;
        }
        ++counts.Gen;
        root.data.secret = 1;
        yield [root, childTrace];
    }
    root.data.sizeBlank = sum(root.children.map(child => child.data.sizeBlank ?? 0), Number(Boolean(root.data.secret)));
    return Number(isInRegion);
};

const skeletonEnc = (root, counts) => {
    if (root.isAllRemoved) {
        return;
    }
    assert(!root.isLeaf || root.data.secret);
    if (root.data.secret) {
        ++counts.Enc;
    } else {
        for (const child of root.children) {
            skeletonEnc(child, counts);
        }
    }
};

export
const makeTreeKEM = (TreeType) => {
    return (
class TreeKEM {
    constructor() {
        this.tree = null;
        this.epoch = 0;
        this.users = [];

        this.counts = Object.fromEntries('random,PRG,Gen,Enc,Dec'.split(',').map(key => [key, 0]));
    }

    init(n) {
        ++this.epoch;
        this.tree = TreeType.init(n, this.epoch);
        for (const leaf of this.tree.getLeaves(true)) {
            const i = this.users.length;
            this.constructor.initData(leaf, i);
            this.users.push(leaf);
        }
        assert(this.users.length === n);
    }
    static initData(leaf, id) {
        leaf.data.id = id;
        leaf.data.secret = 1;
        leaf.data.sizeBlank = 0;
    }

    add(a, b) {
        assert(a in this.users && b === this.users.length);
        ++this.epoch;
        const leafNew = new TreeType(this.epoch);
        this.constructor.initData(leafNew, b);
        this.users.push(leafNew);
        const ua = this.users[a], ub = this.users[b];
        this.tree = this.tree.add(this.epoch, ub, ua);

        const skeletonExtra = new Set();

        const region = new Set(ua.getPath(this.epoch));
        processSkeleton(this.tree, this.epoch, skeletonExtra, region, this.counts);
    }

    remove(a, b) {
        assert(a in this.users && b in this.users && b !== a);
        ++this.epoch;
        const ua = this.users[a], ub = this.users[b];
        delete this.users[b];
        this.tree = this.tree.remove(this.epoch, ub, ua);

        const skeletonExtra = new Set();
        const root = this.tree;
        if (root.epoch < this.epoch) {
            skeletonExtra.add(root);
        }

        const region = new Set(ua.getPath(this.epoch));
        processSkeleton(this.tree, this.epoch, skeletonExtra, region, this.counts);
    }

    update(b, a = b) {
        assert(a in this.users && b in this.users);
        ++this.epoch;
        const ua = this.users[a], ub = this.users[b];

        const skeletonExtra = new Set(ub.getPath(this.epoch));

        const region = new Set(ua.getPath(this.epoch));
        processSkeleton(this.tree, this.epoch, skeletonExtra, region, this.counts);
    }
}
    );
};

export default makeTreeKEM();
