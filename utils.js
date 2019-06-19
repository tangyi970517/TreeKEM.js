const assert = (cond, message = `\`${cond}\` is falsy.`) => {
    if (!cond) {
        throw new Error(message);
    }
};

export {assert};
