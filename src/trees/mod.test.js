import {assert, range, randint} from '../utils.js';

const testTree = (TreeType, n, T, verifyingLeaves = false, verbose = 0) => {
	let [epoch, tree] = TreeType.init(n);
	const leaves = [];
	for (const leaf of tree.getLeaves(true)) {
		leaf.data.name = ['init', leaves.length];
		leaves.push(leaf);
	}
	if (verbose >= 3) tree.print(), tree.B?.print();
	const count = [0, 0, 0];
	for (const t of range(T)) {
		///
do {
		///
		const treeOld = tree;
		const op = randint(3);
		switch (op) {
			case 0: {
				epoch = epoch.step();
				const leafNew = new TreeType(epoch);
				leafNew.data.name = [t, -1];
				const leafHint = leaves[randint(leaves.length)];
				leaves.push(leafNew);
				if (verbose >= 2) console.log('add', leafNew.info, 'by', leafHint.info, 'at', t, '@', epoch);
				const epochGiven = epoch;
				[epoch, tree] = tree.add(epochGiven, leafNew, leafHint);
				assert(tree.Epoch.ge(epoch, epochGiven));
				treeOld.clearTill(epoch, tree);
				if (verbose >= 3) tree.print(), tree.B?.print();
				assert(tree.getTrace() === leafNew);
				assert(tree.epoch === epoch);
			} break;
			case 1: {
				if (leaves.length < 2) {
					continue;
				}
				epoch = epoch.step();
				const [leafOld] = leaves.splice(randint(leaves.length), 1);
				const leafHint = leaves[randint(leaves.length)];
				if (verbose >= 2) console.log('remove', leafOld.info, 'by', leafHint.info, 'at', t, '@', epoch);
				const epochGiven = epoch;
				[epoch, tree] = tree.remove(epochGiven, leafOld, leafHint);
				assert(tree.Epoch.ge(epoch, epochGiven));
				treeOld.clearTill(epoch, tree);
				if (verbose >= 3) tree.print(), tree.B?.print();
				assert(tree.Epoch.ge(epoch, tree.epoch));
			} break;
			case 2: {
				epoch = epoch.step();
				const leaf = leaves[randint(leaves.length)];
				const leafHint = leaves[randint(leaves.length)];
				if (verbose >= 2) console.log('update', leaf.info, 'by', leafHint.info, 'at', t, '@', epoch);
				const epochGiven = epoch;
				[epoch, tree] = tree.update(epochGiven, leaf, leafHint);
				assert(tree.Epoch.ge(epoch, epochGiven));
				if (tree === treeOld) {
					break;
				}
				treeOld.clearTill(epoch, tree);
				if (verbose >= 3) tree.print(), tree.B?.print();
				assert(tree.Epoch.ge(epoch, tree.epoch));
			} break;
		}
		if (verifyingLeaves) for (const leaf of leaves) {
			assert(leaf.getRoot(epoch, true) === tree);
		}
		++count[op];
		///
} while (false) ;
		///
	}
	const [nAdd, nRem, nUpd] = count;
	if (verbose >= 1) console.log('add count', nAdd, '/', T);
	if (verbose >= 1) console.log('remove count', nRem, '/', T);
	if (verbose >= 1) console.log('update count', nUpd, '/', T);
};

const testTreeBounce = (TreeType, n, T, verifyingLeaves = false, verbose = 0) => {
	let [epoch, tree] = TreeType.init(randint(1, n+1));
	const leaves = [];
	for (const leaf of tree.getLeaves(true)) {
		leaf.data.name = ['init', leaves.length];
		leaves.push(leaf);
	}
	if (verbose >= 3) tree.print(), tree.B?.print();
	const count = [0, 0, 0];
	for (const t of range(T)) {
		const nAdd = randint(n - leaves.length + 1);
		count[0] += nAdd;
		if (verbose >= 1) console.log('add count', nAdd, 'from', leaves.length, 'at', t);
		for (const i of range(nAdd)) {
			epoch = epoch.step();
			const leafNew = new TreeType(epoch);
			leafNew.data.name = [t, i];
			const leafHint = leaves[randint(leaves.length)];
			leaves.push(leafNew);
			if (verbose >= 2) console.log('add', leafNew.info, 'by', leafHint.info, 'at', t, ':', i, '@', epoch);
			const treeOld = tree;
			const epochGiven = epoch;
			[epoch, tree] = tree.add(epochGiven, leafNew, leafHint);
			assert(tree.Epoch.ge(epoch, epochGiven));
			treeOld.clearTill(epoch, tree);
			if (verbose >= 3) tree.print(), tree.B?.print();
			assert(tree.getTrace() === leafNew);
			assert(tree.epoch === epoch);
			if (verifyingLeaves) for (const leaf of leaves) {
				assert(leaf.getRoot(epoch, true) === tree);
			}
		}
		const nRem = randint(leaves.length);
		count[1] += nRem;
		if (verbose >= 1) console.log('remove count', nRem, 'from', leaves.length, 'at', t);
		for (const i of range(nRem)) {
			epoch = epoch.step();
			const [leafOld] = leaves.splice(randint(leaves.length), 1);
			const leafHint = leaves[randint(leaves.length)];
			if (verbose >= 2) console.log('remove', leafOld.info, 'by', leafHint.info, 'at', t, ':', i, '@', epoch);
			const treeOld = tree;
			const epochGiven = epoch;
			[epoch, tree] = tree.remove(epochGiven, leafOld, leafHint);
			assert(tree.Epoch.ge(epoch, epochGiven));
			treeOld.clearTill(epoch, tree);
			if (verbose >= 3) tree.print(), tree.B?.print();
			assert(tree.Epoch.ge(epoch, tree.epoch));
			if (verifyingLeaves) for (const leaf of leaves) {
				assert(leaf.getRoot(epoch, true) === tree);
			}
		}
		const nUpd = randint(leaves.length+1);
		count[2] += nUpd;
		if (verbose >= 1) console.log('update count', nUpd, 'at', t);
		for (const i of range(nUpd)) {
			epoch = epoch.step();
			const leaf = leaves[randint(leaves.length)];
			const leafHint = leaves[randint(leaves.length)];
			if (verbose >= 2) console.log('update', leaf.info, 'by', leafHint.info, 'at', t, ':', i, '@', epoch);
			const treeOld = tree;
			const epochGiven = epoch;
			[epoch, tree] = tree.update(epochGiven, leaf, leafHint);
			assert(tree.Epoch.ge(epoch, epochGiven));
			if (tree === treeOld) {
				continue;
			}
			treeOld.clearTill(epoch, tree);
			if (verbose >= 3) tree.print(), tree.B?.print();
			assert(tree.Epoch.ge(epoch, tree.epoch));
			if (verifyingLeaves) for (const leaf of leaves) {
				assert(leaf.getRoot(epoch, true) === tree);
			}
		}
	}
	const [nAdd, nRem, nUpd] = count;
	if (verbose >= 1) console.log('add count', nAdd, '≈', n, '*', T, '/3');
	if (verbose >= 1) console.log('remove count', nRem, '≈', n, '*', T, '/3');
	if (verbose >= 1) console.log('update count', nUpd, '≈', n, '*', T, '/2');
};

import {TreeTypes} from './mod.js';

for (const [desc, TreeType] of TreeTypes) {
	Deno.test(`test tree: ${desc}; random small`, () => testTree(TreeType, 30, 1000, true));
	Deno.test(`test tree: ${desc}; random large`, () => testTree(TreeType, 600, 10000));
	Deno.test(`test tree: ${desc}; random giant`, () => testTree(TreeType, 10000, 100000));
	Deno.test(`test tree: ${desc}; bounce small`, () => testTreeBounce(TreeType, 30, 100, true));
	if (desc.startsWith('left:') && desc.includes('append'))
	Deno.test(`test tree: ${desc}; bounce large`, () => testTreeBounce(TreeType, 600, 100));
	else
	Deno.test(`test tree: ${desc}; bounce large`, () => testTreeBounce(TreeType, 600, 1000));
}
