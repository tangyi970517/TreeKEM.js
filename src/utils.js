export
const assert = (cond, ...messages) => {
	if (!cond) {
		console.assert(cond, ...messages);
		throw new Error(messages[0]);
	}
};

const parseStartEnd = (endOrStart, nullOrEnd = null) => nullOrEnd === null ? [0, endOrStart] : [endOrStart, nullOrEnd];

export
const range = function * (endOrStart, nullOrEnd = null, step = 1) {
	const [start, end] = parseStartEnd(endOrStart, nullOrEnd);
	for (let i = start; i < end; i += step) {
		yield i;
	}
};

export
const randint = (endOrStart, nullOrEnd = null) => {
	const [start, end] = parseStartEnd(endOrStart, nullOrEnd);
	return Math.floor(Math.random() * (end - start) + start);
};

export
const sum = (list, init = 0) => list.reduce((s, a) => s + a, init);
export
const prod = (list, init = 1) => list.reduce((p, a) => p * a, init);
export
const conjunct = (list, init = true) => list.reduce((b, a) => b && a, init);
export
const disjunct = (list, init = false) => list.reduce((b, a) => b || a, init);
export
const coalesce = (list, init = null) => list.reduce((o, a) => o ?? a, init);

export
const replace = (list, itemOld, ...itemsNew) => {
	const i = list.indexOf(itemOld);
	assert(i >= 0, 'replace not found');
	const j = list.lastIndexOf(itemOld);
	assert(i === j, 'replace ambiguous');
	return list.toSpliced(i, 1, ...itemsNew);
};

export
const randomChoice = (list, weightFuncKey = null, weightSumHint = null) => {
	let weightFunc;
	if (weightFuncKey === null) {
		weightFunc = _ => 1;
	} else if (typeof weightFuncKey === 'string' || typeof weightFuncKey === 'symbol') {
		weightFunc = x => x[weightFuncKey];
	} else {
		weightFunc = weightFuncKey;
	}
	const weights = list.map(weightFunc);
	const weightSum = weightSumHint ?? sum(weights);
	const r = Math.random() * weightSum;
	let s = 0;
	for (const [i, x] of list.entries()) {
		s += weights[i];
		if (r < s) {
			return x;
		}
	}
	assert(false, 'choice out of range');
};
