import {range, randint} from './utils.js';

import CounterCrypto from './crypto/counter.js';
const crypto = new CounterCrypto();

const testTreeKEM = (TreeKEMType, n, T, verbose = 0) => {
    const TreeKEM = new TreeKEMType();
    const ks = Array.from(Array(n), () => crypto.Gen(crypto.random()));
    const pks = ks.map(k => k[0]), sk0 = ks[0][1];
    TreeKEM.init(pks, sk0);
    const users = [...range(n)];
    let userLast = n-1;
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
                const [pk, _] = crypto.Gen(crypto.random());
                TreeKEM.add(user, userNew, pk);
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
            } break;
            case 2: {
                const userCom = users[randint(users.length)];
                const user = users[randint(users.length)];
                if (verbose >= 1) console.log('update', userCom, 'by', user, 'at', t);
                TreeKEM.update(userCom, user);
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

import {TreeTypes} from './trees/mod.js';

const TreeKEMTypes = new Map();
for (const [descTree, TreeType] of TreeTypes.entries()) {
    TreeKEMTypes.set(`tree=(${descTree})`, makeTreeKEM(TreeType, CounterCrypto));
}

for (const [desc, TreeKEMType] of TreeKEMTypes.entries()) {
    Deno.test(`test TreeKEM: ${desc}; small`, () => testTreeKEM(TreeKEMType, 30, 1000));
    Deno.test(`test TreeKEM: ${desc}; large`, () => testTreeKEM(TreeKEMType, 600, 10000));
    Deno.test(`test TreeKEM: ${desc}; giant`, () => testTreeKEM(TreeKEMType, 10000, 100000));
}
