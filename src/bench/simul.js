import {assert, range, randint, randomChoice, shuffle} from '../utils.js';

export
const OpSeqEnums = {
	dist: [
		'uniform',
		'weighted',
		'geom',
		'geom-end',
		'Zipf',
		'point',
	],
	distBit: [
		'binom',
		'point',
		'point-match',
	],
};

const randomZipf = (list, exponent, compare) => {
	const rank = list.sort(compare).map((x, k) => [k+1, x]);
	return randomChoice(rank, ([k]) => 1/k**exponent)[1];
};

const quickSortStream = function * (list, compare) {
	if (list.length === 0) {
		return;
	}
	const x = list[randint(list.length)];
	const compares = list.map(y => compare(x, y));
	yield * quickSortStream(list.filter((_, i) => compares[i] < 0), compare);
	yield * list.filter((_, i) => compares[i] === 0);
	yield * quickSortStream(list.filter((_, i) => compares[i] > 0), compare);
};
const quickZipf = (list, compare) => {
	let k = 1;
	let s = Math.log(list.length) + 0.57721_56649_01532_86; // approx using Euler's constant
	for (const x of quickSortStream(list, compare)) {
		if (Math.random() < (1/k) / s || k === list.length) {
			return x;
		}
		s -= 1/k;
		++k;
	}
	assert(false);
};

export
const randomUnder = (list, dist, ...args) => {
	switch (dist) {
		case 'uniform': {
			return list[randint(list.length)];
		} break;
		case 'weighted': {
			return randomChoice(list, ...args);
		} break;
		case 'geom': {
			const [prob = 1/2] = args;
			for (const i of range(list.length)) {
				if (Math.random() < prob) {
					return list[i];
				}
			}
			return list[list.length-1];
		} break;
		case 'geom-end': {
			const [prob = 1/2] = args;
			for (const i of range(list.length)) {
				if (Math.random() < prob) {
					return list[list.length-1 - i];
				}
			}
			return list[0];
		} break;
		case 'Zipf': {
			const [
				exponent = 1, // generalized Zipf
				hashMult = 48271, hashBias = 0, hashMod = 2**31-1, // minstd_rand
			] = args;
			const hash = x => (x * hashMult + hashBias) % hashMod;
			const hashed = list.map(x => [hash(hash(x)), x]);
			const compare = ([a], [b]) => a - b;
			if (exponent === 1) {
				return quickZipf(hashed, compare)[1];
			}
			return randomZipf(hashed, exponent, compare)[1];
		} break;
		case 'point': {
			return args[0];
		} break;
	}
};

export
const randomBitUnder = (context, dist, ...args) => {
	switch (dist) {
		case 'binom': {
			const [prob = 1/2] = args;
			return Number(Math.random() < prob);
		} break;
		case 'point': {
			return args[0];
		} break;
		case 'point-match': {
			const item = context;
			const list = args;
			return Number(list.includes(item));
		} break;
	}
};

export
const genOpSeq = function * (n, T, [pAdd, pRem, pUpd = 1 - pAdd - pRem], {
	nAdmin = null,
	ratioAdmin = null,

	startingWarm = false,

	usingAdmin = false,

	usingAddByAdmin = usingAdmin,

	usingRemByAdmin = usingAdmin,

	allowingUpdByOther = false,
	usingUpdByAdmin = allowingUpdByOther && usingAdmin,
	allowingUpdOfAdmin = true,
	distUserUpd = 'uniform',
	distUserUpdArgs = [],

	usingCommitByAdmin = usingAdmin,
	distCommit = 'point',
	distCommitArgs = [1],
	distUserCommit = 'point',
	distUserCommitArgs = [null],
} = {}) {
	assert(OpSeqEnums.dist.includes(distUserUpd));
	assert(OpSeqEnums.distBit.includes(distCommit));
	assert(OpSeqEnums.dist.includes(distUserCommit));

	const users = [...range(n)];
	let userLast = n-1;
	const usersCopy = users.slice();

	nAdmin ??= ratioAdmin && (n * ratioAdmin);
	nAdmin ??= 0;
	shuffle(users, nAdmin);
	const admins = nAdmin > 0 ? users.splice(0, nAdmin) : null;

	yield ['init', usersCopy, ...(admins?.slice(0, 1) ?? [])];
	if (startingWarm) {
		yield ['_fill'];
	}

	const tTotal = {
		add: 0,
		remove: 0,
		update: 0,
		commit: 0,
	};
	for (const t of range(T)) {
		///
do {
		///
		const {op} = randomChoice([
			{op: 'add', weight: pAdd},
			{op: 'remove', weight: pRem},
			{op: 'update', weight: pUpd},
		], 'weight', 1);
		let user;
		switch (op) {
			case 'add': {
				const userNew = ++userLast;
				const adders = usingAddByAdmin ? admins ?? users : users;
				user = adders[randint(adders.length)];
				users.push(userNew);
				yield [op, user, userNew];
			} break;
			case 'remove': {
				if (users.length < 2) {
					continue;
				}
				const [userOld] = users.splice(randint(users.length), 1);
				const removers = usingRemByAdmin ? admins ?? users : users;
				user = removers[randint(removers.length)];
				yield [op, user, userOld];
			} break;
			case 'update': {
				const updatees = allowingUpdOfAdmin ? (admins ?? []).concat(users) : users;
				const userCom = randomUnder(updatees, distUserUpd, ...distUserUpdArgs);
				if (allowingUpdByOther) {
					const updaters = usingUpdByAdmin ? admins ?? users : users;
					user = updaters[randint(updaters.length)];
					yield [op, userCom, user];
					break;
				} else {
					user = userCom;
				}
				yield [op, userCom];
			} break;
		}
		++tTotal[op];
		if (randomBitUnder(op, distCommit, ...distCommitArgs) || t === T-1) {
			const committers = usingCommitByAdmin ? admins ?? users : users;
			const userCommit = randomUnder(committers, distUserCommit, ...distUserCommitArgs) ?? user;
			yield ['commit', userCommit];
			++tTotal['commit'];
		}
		///
} while (false) ;
		///
	}

	const nTotal = userLast+1;
	yield ['_noop', {nAdmin, nTotal, tTotal}];
};

export
const testOpSeq = (TreeKEMType, seq) => {
	const KEM = new TreeKEMType();
	for (const [op, ...args] of seq) {
		KEM[op](...args);
	}
	return KEM.crypto.stat;
};
