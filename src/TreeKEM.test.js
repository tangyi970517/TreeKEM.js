import {assert, range, randint} from './utils.js';

const testTreeKEM = (TreeKEMType, n, T, verifyingTaints = false, verbose = 0) => {
	const TreeKEM = new TreeKEMType();
	const users = [...range(n)];
	let userLast = n-1;
	const cryptoOld = TreeKEM.init(users);
	if (verbose >= 1) console.log('init stat', cryptoOld.stat);
	TreeKEM._fill();
	if (verbose >= 3) TreeKEM.tree.root.print();
	const count = [0, 0, 0, 0];
	for (const t of range(T)) {
		///
do {
		///
		const op = randint(3);
		switch (op) {
			case 0: {
				const userNew = ++userLast;
				const user = users[randint(users.length)];
				users.push(userNew);
				if (verbose >= 2) console.log('add', userNew, 'by', user, 'at', t);
				TreeKEM.add(user, userNew);
				if (verbose >= 3) TreeKEM.tree.root.print();
			} break;
			case 1: {
				if (users.length < 2) {
					continue;
				}
				const [userOld] = users.splice(randint(users.length), 1);
				const user = users[randint(users.length)];
				if (verbose >= 2) console.log('remove', userOld, 'by', user, 'at', t);
				TreeKEM.remove(user, userOld);
				if (verbose >= 3) TreeKEM.tree.root.print();
			} break;
			case 2: {
				const userCom = users[randint(users.length)];
				const user = users[randint(users.length)];
				if (verbose >= 2) console.log('update', userCom, 'by', user, 'at', t);
				TreeKEM.update(userCom, user);
				if (verbose >= 3) TreeKEM.tree.root.print();
			} break;
		}
		if (verifyingTaints) for (const user of users) for (const node of TreeKEM.taint.getTaint(TreeKEM.users.get(user))) {
			assert(node.getRoot(TreeKEM.tree.epoch, true) === TreeKEM.tree.root || node.isComponent);
		}
		++count[op];
		if (Math.random() < 1/3 || t === T-1) {
			const user = users[randint(users.length)];
			if (verbose >= 2) console.log('commit', 'by', user, 'at', t);
			TreeKEM.commit(user);
			if (verbose >= 3) TreeKEM.tree.root.print();
			if (verifyingTaints) for (const user of users) for (const node of TreeKEM.taint.getTaint(TreeKEM.users.get(user))) {
				assert(node.getRoot(TreeKEM.tree.epoch, true) === TreeKEM.tree.root || node.isComponent);
			}
			++count[3];
		}
		///
} while (false) ;
		///
	}
	const [nAdd, nRem, nUpd, nCommit] = count;
	if (verbose >= 1) console.log('add count', nAdd, '/', T);
	if (verbose >= 1) console.log('remove count', nRem, '/', T);
	if (verbose >= 1) console.log('update count', nUpd, '/', T);
	if (verbose >= 1) console.log('commit count', nCommit, '/', T);
	if (verbose >= 1) console.log('stat', TreeKEM.crypto.stat, '/', T);
};

import {makeTreeKEM} from './TreeKEM.js';

import {TreeTypes, DefaultTreeTypes} from './trees/mod.js';

import {RegionTypes} from './regions/mod.js';
import {makeDepthRegion} from './regions/DepthRegion.js';

import CounterCrypto from './crypto/counter.js';

const TreeKEMTypes = new Map();
for (const usingUnmergedNodesForBlank of [false, true])
for (const usingUnmergedNodesForSecret of [false, true])
for (const usingSKE of [false, true])
for (const [descTree, TreeType] of DefaultTreeTypes)
for (const [descRegion, RegionType] of RegionTypes)
for (const depth of [0, 1])
{
	TreeKEMTypes.set(`
flag-unmerged-blank=${Number(usingUnmergedNodesForBlank)}
flag-unmerged-secret=${Number(usingUnmergedNodesForSecret)}
flag-SKE=${Number(usingSKE)}
tree=(${descTree})
region-enc=(${descRegion})
region-dec-depth=${depth}
	`.trim().split('\n').join(', '), makeTreeKEM(CounterCrypto, {
		usingUnmergedNodesForBlank,
		usingUnmergedNodesForSecret,
		usingSKE,
	}, TreeType, RegionType, makeDepthRegion(depth)));
}

for (const [desc, TreeKEMType] of TreeKEMTypes) {
	Deno.test(`test TreeKEM: ${desc}; small`, () => testTreeKEM(TreeKEMType, 30, 1000, true));
	Deno.test(`test TreeKEM: ${desc}; large`, () => testTreeKEM(TreeKEMType, 600, 10000));
	Deno.test(`test TreeKEM: ${desc}; giant`, () => testTreeKEM(TreeKEMType, 10000, 100000));
}
