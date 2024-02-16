import {assert, range, randint} from '../utils.js';

const testTree = (TreeType, n, T, isFast = true, verbose = 0) => {
    let tree = TreeType.init(n);
    if (verbose >= 3) tree.print();
    const leaves = [];
    for (const leaf of tree.getLeaves(true)) {
        leaf.data = ['init', leaves.length];
        leaves.push(leaf);
    }
    const count = [0, 0];
    for (const t of range(T)) {
        const op = randint(2);
        ++count[op];
        switch (op) {
            case 0: {
                const leafNew = new TreeType();
                leafNew.data = [t];
                const leafHint = leaves[randint(leaves.length)];
                leaves.push(leafNew);
                if (verbose >= 1) console.log('add', leafNew.data, 'by', leafHint.data, 'at', t);
                tree = tree.add(leafNew, leafHint);
                if (verbose >= 3) tree.print();
            } break;
            case 1: {
                if (leaves.length < 2) {
                    --count[op];
                    continue;
                }
                const leafOld = leaves.splice(randint(leaves.length), 1)[0];
                if (verbose >= 1) console.log('remove', leafOld.data, 'at', t);
                tree = tree.remove(leafOld);
                if (verbose >= 3) tree.print();
            } break;
        }
        if (!isFast) for (const leaf of leaves) {
            assert(leaf.getRoot() === tree);
        }
    }
    const [nAdd, nRem] = count;
    if (verbose >= 1) console.log('add count', nAdd, '/', T);
    if (verbose >= 1) console.log('remove count', nRem, '/', T);
};

const testTreeBounce = (TreeType, n, T, isFast = true, verbose = 0) => {
    let tree = TreeType.init(randint(1, n+1));
    if (verbose >= 3) tree.print();
    const leaves = [];
    for (const leaf of tree.getLeaves(true)) {
        leaf.data = ['init', leaves.length];
        leaves.push(leaf);
    }
    const count = [0, 0];
    for (const t of range(T)) {
        const nAdd = randint(n - leaves.length + 1);
        count[0] += nAdd;
        if (verbose >= 1) console.log('add count', nAdd, 'from', leaves.length, 'at', t);
        for (const i of range(nAdd)) {
            const leafNew = new TreeType();
            leafNew.data = [t, i];
            const leafHint = leaves[randint(leaves.length)];
            leaves.push(leafNew);
            if (verbose >= 2) console.log('add', leafNew.data, 'by', leafHint.data, 'at', t, ':', i);
            tree = tree.add(leafNew, leafHint);
            if (verbose >= 3) tree.print();
            if (!isFast) for (const leaf of leaves) {
                assert(leaf.getRoot() === tree);
            }
        }
        const nRem = randint(leaves.length);
        count[1] += nRem;
        if (verbose >= 1) console.log('remove count', nRem, 'from', leaves.length, 'at', t);
        for (const i of range(nRem)) {
            const leafOld = leaves.splice(randint(leaves.length), 1)[0];
            if (verbose >= 2) console.log('remove', leafOld.data, 'at', t, ':', i);
            tree = tree.remove(leafOld);
            if (verbose >= 3) tree.print();
            if (!isFast) for (const leaf of leaves) {
                assert(leaf.getRoot() === tree);
            }
        }
    }
    const [nAdd, nRem] = count;
    if (verbose >= 1) console.log('add count', nAdd, '≈', n, '*', T, '/3');
    if (verbose >= 1) console.log('remove count', nRem, '≈', n, '*', T, '/3');
};

import {LeftTreeEnums, makeLeftTree} from './LeftTree.js';
import {BTreeEnums, makeBTree, make23Tree, make234Tree} from './BTree.js';

export
const TreeTypes = new Map();
for (const position of LeftTreeEnums.position)
for (const truncate of LeftTreeEnums.truncate) {
    if (position === 'random') continue;
    TreeTypes.set(`left: pos=${position}, rem=${truncate}`, makeLeftTree(position, truncate));
}
for (const position of BTreeEnums.position) {
    if (position === 'random') continue;
    TreeTypes.set(`2-3: pos=${position}`, make23Tree(position));
    TreeTypes.set(`2-3-4: pos=${position}`, make234Tree(position));
}
for (const m of [5, 8, 13, 21])
for (const position of BTreeEnums.position) {
    if (position === 'random') continue;
    TreeTypes.set(`B: max=${m}, pos=${position}`, makeBTree(m, position));
}

for (const [desc, TreeType] of TreeTypes.entries()) {
    Deno.test(`test tree: ${desc}; random small`, () => testTree(TreeType, 30, 1000, false));
    Deno.test(`test tree: ${desc}; random large`, () => testTree(TreeType, 600, 10000));
    Deno.test(`test tree: ${desc}; random giant`, () => testTree(TreeType, 10000, 100000));
    Deno.test(`test tree: ${desc}; bounce small`, () => testTreeBounce(TreeType, 30, 100, false));
    Deno.test(`test tree: ${desc}; bounce large`, () => testTreeBounce(TreeType, 600, 1000));
}
