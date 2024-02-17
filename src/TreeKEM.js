import {assert, sum} from './utils.js';

const processSkeleton = function * (root, epoch, skeletonExtra, region, crypto) {
    for (const [node, seed, childTrace] of skeletonGen(root, epoch, skeletonExtra, region, crypto)) {
        assert(!node.isLeaf);
        assert(childTrace === null || node.children.indexOf(childTrace) >= 0);
        for (const child of node.children) {
            if (node === childTrace) {
                continue;
            }
            yield * skeletonEnc(child, seed, crypto);
        }
    }
    assert(skeletonExtra.size === 0);
};

const isSkeleton = (node, epoch, skeletonExtra) => node.epoch === epoch || skeletonExtra.has(node);

const skeletonGen = function * (root, epoch, skeletonExtra, region, crypto) {
    assert(isSkeleton(root, epoch, skeletonExtra));
    skeletonExtra.delete(root);
    if (root.isAllRemoved) {
        return null;
    }
    if (root.isLeaf) {
        assert(root.data.pk);
        return null;
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
        const seed = yield * skeletonGen(child, epoch, skeletonExtra, region, crypto);
        if (child === childTrace) {
            seedTrace = seed;
        }
    }
    root.data.pk = null;
    root.data.sk = null;
    let seed = null;
    if (isInRegion) {
        let secret;
        if (seedTrace) {
            [seed, secret] = crypto.PRG(seedTrace, 2);
        } else {
            [seed, secret] = crypto.random(2);
        }
        [root.data.pk, root.data.sk] = crypto.Gen(secret);
        yield [root, seedTrace, childTrace];
    }
    root.data.sizeBlank = sum(root.children.map(child => child.data.sizeBlank ?? 0), Number(Boolean(root.data.pk)));
    return seed;
};

const skeletonEnc = function * (root, seed, crypto) {
    if (root.isAllRemoved) {
        return;
    }
    assert(!root.isLeaf || root.data.pk);
    if (root.data.pk) {
        yield crypto.Enc(root.data.pk, seed);
    } else {
        for (const child of root.children) {
            skeletonEnc(child, seed, crypto);
        }
    }
};

export
const makeTreeKEM = (TreeType, Crypto) => {
    return (
class TreeKEM {
    constructor() {
        this.tree = null;
        this.epoch = 0;
        this.users = [];

        this.crypto = new Crypto();
    }

    init(pks, sk0) {
        ++this.epoch;
        const n = pks.length;
        this.tree = TreeType.init(n, this.epoch);
        for (const leaf of this.tree.getLeaves(true)) {
            const i = this.users.length;
            this.constructor.initData(leaf, i, pks[i], i === 0 ? sk0 : null);
            this.users.push(leaf);
        }
        assert(this.users.length === n);

        const ua = this.users[0];

        const skeletonExtra = new Set();

        const region = new Set(ua.getPath(this.epoch));
        for (const _ of function * () {
        yield * processSkeleton(this.tree, this.epoch, skeletonExtra, region, this.crypto);
        }.bind(this)()) ;

        this.crypto = new Crypto();
    }
    static initData(leaf, id, pk, sk = null) {
        leaf.data.id = id;
        leaf.data.pk = pk;
        leaf.data.sk = sk;
        leaf.data.sizeBlank = 0;
    }

    add(a, b, pk) {
        assert(a in this.users && b === this.users.length);
        ++this.epoch;
        const leafNew = new TreeType(this.epoch);
        this.constructor.initData(leafNew, b, pk);
        this.users.push(leafNew);
        const ua = this.users[a], ub = this.users[b];
        this.tree = this.tree.add(this.epoch, ub, ua);

        const skeletonExtra = new Set();

        const region = new Set(ua.getPath(this.epoch));
        for (const _ of function * () {
        yield * processSkeleton(this.tree, this.epoch, skeletonExtra, region, this.crypto);
        }.bind(this)()) ;
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
        for (const _ of function * () {
        yield * processSkeleton(this.tree, this.epoch, skeletonExtra, region, this.crypto);
        }.bind(this)()) ;
    }

    update(b, a = b) {
        assert(a in this.users && b in this.users);
        ++this.epoch;
        const ua = this.users[a], ub = this.users[b];

        const skeletonExtra = new Set(ub.getPath(this.epoch));

        const region = new Set(ua.getPath(this.epoch));
        for (const _ of function * () {
        yield * processSkeleton(this.tree, this.epoch, skeletonExtra, region, this.crypto);
        }.bind(this)()) ;
    }
}
    );
};

export default makeTreeKEM();
