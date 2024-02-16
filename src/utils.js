export
const assert = (cond, message = `\`${cond}\` is falsy.`) => {
    if (!cond) {
        throw new Error(message);
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
