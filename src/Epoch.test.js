import {assert} from './utils.js';
import Epoch, {LinearEpoch, EpochMap} from './Epoch.js';

Deno.test('epoch: get lowest ancestor', (_, verbose = 0) => {
	const e = new Epoch();
	if (verbose) console.log(`${e}`);
	const e1 = e.step(), e1_ = e.step(), e1__ = e.step(), e1___ = e.step(), e1____ = e.step();
	if (verbose) console.log(`${e1}`, `${e1_}`, `${e1__}`, `${e1___}`, `${e1____}`);
	const e2 = e1.step(), e1_1 = e1_.step();
	if (verbose) console.log(`${e2}`, `${e1_1}`);
	const e3 = e2.step(), e3_ = e2.step(), e1_2 = e1_1.step();
	if (verbose) console.log(`${e3}`, `${e3_}`, `${e1_2}`);
	const e4 = e3.step(), e3_1 = e3_.step();
	if (verbose) console.log(`${e4}`, `${e3_1}`);
	const e5 = e4.step(), e3_2 = e3_1.step();
	if (verbose) console.log(`${e5}`, `${e3_2}`);
	const e6 = e5.step(), e3_3 = e3_2.step();
	if (verbose) console.log(`${e6}`, `${e3_3}`);

	const map = new EpochMap();
	map.set(e1_, '1_');
	map.set(e2, '2');
	map.set(e3_, '3_');
	map.set(e4, '4');
	map.set(e5, '5');
	if (verbose) console.log(map);
	assert(map.getLowestAncestor(e1) === null);
	assert(map.getLowestAncestor(e1__) === null);
	assert(map.getLowestAncestor(e2)?.[1] === '2');
	assert(map.getLowestAncestor(e1_1)?.[1] === '1_');
	assert(map.getLowestAncestor(e3)?.[1] === '2');
	assert(map.getLowestAncestor(e1_2)?.[1] === '1_');
	assert(map.getLowestAncestor(e4)?.[1] === '4');
	assert(map.getLowestAncestor(e3_1)?.[1] === '3_');
	assert(map.getLowestAncestor(e5)?.[1] === '5');
	assert(map.getLowestAncestor(e3_2)?.[1] === '3_');
	assert(map.getLowestAncestor(e6)?.[1] === '5');
	assert(map.getLowestAncestor(e3_3)?.[1] === '3_');
});

Deno.test('linear epoch: singleton', () => {
	const e0 = new LinearEpoch();
	assert(e0 === new LinearEpoch());
	assert(e0.step() === new LinearEpoch().step());
	assert(e0.step().getAncestor(0) === new LinearEpoch());
});
