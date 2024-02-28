import {range, randint} from './utils.js';

const testTreeKEM = (TreeKEMType, n, T, verbose = 0) => {
	const TreeKEM = new TreeKEMType();
	const users = [...range(n)];
	let userLast = n-1;
	const cryptoOld = TreeKEM.init(users);
	if (verbose >= 1) console.log('init stat', cryptoOld.stat);
	TreeKEM._fill();
	if (verbose >= 3) TreeKEM.tree.print();
	const count = [0, 0, 0];
	for (const t of range(T)) {
		const op = randint(3);
		++count[op];
		switch (op) {
			case 0: {
				const userNew = ++userLast;
				const user = users[randint(users.length)];
				users.push(userNew);
				if (verbose >= 1) console.log('add', userNew, 'by', user, 'at', t);
				TreeKEM.add(user, userNew);
				if (verbose >= 3) TreeKEM.tree.print();
			} break;
			case 1: {
				if (users.length < 2) {
					--count[op];
					continue;
				}
				const userOld = users.splice(randint(users.length), 1)[0];
				const user = users[randint(users.length)];
				if (verbose >= 1) console.log('remove', userOld, 'by', user, 'at', t);
				TreeKEM.remove(user, userOld);
				if (verbose >= 3) TreeKEM.tree.print();
			} break;
			case 2: {
				const userCom = users[randint(users.length)];
				const user = users[randint(users.length)];
				if (verbose >= 1) console.log('update', userCom, 'by', user, 'at', t);
				TreeKEM.update(userCom, user);
				if (verbose >= 3) TreeKEM.tree.print();
			} break;
		}
	}
	const [nAdd, nRem, nUpd] = count;
	if (verbose >= 1) console.log('add count', nAdd, '/', T);
	if (verbose >= 1) console.log('remove count', nRem, '/', T);
	if (verbose >= 1) console.log('update count', nUpd, '/', T);
	if (verbose >= 1) console.log('stat', TreeKEM.crypto.stat, '/', T);
};

import {makeTreeKEM} from './TreeKEM.js';

import {TreeTypes, DefaultTreeTypes} from './trees/mod.js';

import {RegionTypes} from './regions/mod.js';
import {makeDepthRegion} from './regions/DepthRegion.js';

import CounterCrypto from './crypto/counter.js';

const TreeKEMTypes = new Map();
for (const usingUnmergedNodes of [false, true])
for (const [descTree, TreeType] of DefaultTreeTypes)
for (const [descRegion, RegionType] of RegionTypes)
for (const depth of [0, 1])
{
	TreeKEMTypes.set(`flag-unmerged=${Number(usingUnmergedNodes)}, tree=(${descTree}), region-enc=(${descRegion}), region-dec-depth=${depth}`, makeTreeKEM(CounterCrypto, {usingUnmergedNodes}, TreeType, RegionType, makeDepthRegion(depth)));
}

for (const [desc, TreeKEMType] of TreeKEMTypes) {
	Deno.test(`test TreeKEM: ${desc}; small`, () => testTreeKEM(TreeKEMType, 30, 1000));
	Deno.test(`test TreeKEM: ${desc}; large`, () => testTreeKEM(TreeKEMType, 600, 10000));
	Deno.test(`test TreeKEM: ${desc}; giant`, () => testTreeKEM(TreeKEMType, 10000, 100000));
}
