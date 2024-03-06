import {assert, range, randint} from '../utils.js';

const testTree = (TreeType, n, T, isFast = true, verbose = 0) => {
	let epoch = 1;
	let tree = TreeType.init(n, epoch);
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
				++epoch;
				const leafNew = new TreeType(epoch);
				leafNew.data.name = [t, -1];
				const leafHint = leaves[randint(leaves.length)];
				leaves.push(leafNew);
				if (verbose >= 2) console.log('add', leafNew.info, 'by', leafHint.info, 'at', t, '@', epoch);
				tree = tree.add(epoch, leafNew, leafHint);
				treeOld.clearTill(epoch, tree);
				if (verbose >= 3) tree.print(), tree.B?.print();
				assert(tree.getTrace() === leafNew);
				assert(tree.epoch === epoch);
			} break;
			case 1: {
				if (leaves.length < 2) {
					continue;
				}
				++epoch;
				const [leafOld] = leaves.splice(randint(leaves.length), 1);
				const leafHint = leaves[randint(leaves.length)];
				if (verbose >= 2) console.log('remove', leafOld.info, 'by', leafHint.info, 'at', t, '@', epoch);
				tree = tree.remove(epoch, leafOld, leafHint);
				treeOld.clearTill(epoch, tree);
				if (verbose >= 3) tree.print(), tree.B?.print();
				assert(tree.epoch <= epoch);
			} break;
			case 2: {
				++epoch;
				const leaf = leaves[randint(leaves.length)];
				const leafHint = leaves[randint(leaves.length)];
				if (verbose >= 2) console.log('update', leaf.info, 'by', leafHint.info, 'at', t, '@', epoch);
				tree = tree.update(epoch, leaf, leafHint);
				if (tree === treeOld) {
					break;
				}
				treeOld.clearTill(epoch, tree);
				if (verbose >= 3) tree.print(), tree.B?.print();
				assert(tree.epoch <= epoch);
			} break;
		}
		if (!isFast) for (const leaf of leaves) {
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

const testTreeBounce = (TreeType, n, T, isFast = true, verbose = 0) => {
	let epoch = 1;
	let tree = TreeType.init(randint(1, n+1), epoch);
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
			++epoch;
			const leafNew = new TreeType(epoch);
			leafNew.data.name = [t, i];
			const leafHint = leaves[randint(leaves.length)];
			leaves.push(leafNew);
			if (verbose >= 2) console.log('add', leafNew.info, 'by', leafHint.info, 'at', t, ':', i, '@', epoch);
			const treeOld = tree;
			tree = tree.add(epoch, leafNew, leafHint);
			treeOld.clearTill(epoch, tree);
			if (verbose >= 3) tree.print(), tree.B?.print();
			assert(tree.getTrace() === leafNew);
			assert(tree.epoch === epoch);
			if (!isFast) for (const leaf of leaves) {
				assert(leaf.getRoot(epoch, true) === tree);
			}
		}
		const nRem = randint(leaves.length);
		count[1] += nRem;
		if (verbose >= 1) console.log('remove count', nRem, 'from', leaves.length, 'at', t);
		for (const i of range(nRem)) {
			++epoch;
			const [leafOld] = leaves.splice(randint(leaves.length), 1);
			const leafHint = leaves[randint(leaves.length)];
			if (verbose >= 2) console.log('remove', leafOld.info, 'by', leafHint.info, 'at', t, ':', i, '@', epoch);
			const treeOld = tree;
			tree = tree.remove(epoch, leafOld, leafHint);
			treeOld.clearTill(epoch, tree);
			if (verbose >= 3) tree.print(), tree.B?.print();
			assert(tree.epoch <= epoch);
			if (!isFast) for (const leaf of leaves) {
				assert(leaf.getRoot(epoch, true) === tree);
			}
		}
		const nUpd = randint(leaves.length+1);
		count[2] += nUpd;
		if (verbose >= 1) console.log('update count', nUpd, 'at', t);
		for (const i of range(nUpd)) {
			++epoch;
			const leaf = leaves[randint(leaves.length)];
			const leafHint = leaves[randint(leaves.length)];
			if (verbose >= 2) console.log('update', leaf.info, 'by', leafHint.info, 'at', t, ':', i, '@', epoch);
			const treeOld = tree;
			tree = tree.update(epoch, leaf, leafHint);
			if (tree === treeOld) {
				continue;
			}
			treeOld.clearTill(epoch, tree);
			if (verbose >= 3) tree.print(), tree.B?.print();
			assert(tree.epoch <= epoch);
			if (!isFast) for (const leaf of leaves) {
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
	Deno.test(`test tree: ${desc}; random small`, () => testTree(TreeType, 30, 1000, false));
	Deno.test(`test tree: ${desc}; random large`, () => testTree(TreeType, 600, 10000));
	Deno.test(`test tree: ${desc}; random giant`, () => testTree(TreeType, 10000, 100000));
	Deno.test(`test tree: ${desc}; bounce small`, () => testTreeBounce(TreeType, 30, 100, false));
	if (desc.startsWith('left:') && desc.includes('append'))
	Deno.test(`test tree: ${desc}; bounce large`, () => testTreeBounce(TreeType, 600, 100));
	else
	Deno.test(`test tree: ${desc}; bounce large`, () => testTreeBounce(TreeType, 600, 1000));
}
