export
const work = (url, func, ...args) => {
	const worker = new Worker(import.meta.url, {type: 'module'});

	const queueMessage = [], queueIterate = [];
	worker.addEventListener('message', ({data: [type, value]}) => {
		let data;
		switch (type) {
			case 'exec': {
				console.warn('[worker exec]', ...value);
				data = null;
			} break;
			case 'yield': {
				data = {done: false, value};
			} break;
			case 'done': {
				console.warn('[worker done]', ...value);
				data = {done: true, value};
				worker.terminate();
			} break;
		}
		if (!data) {
			return;
		}
		if (queueIterate.length === 0) {
			queueMessage.push(['resolve', data]);
			return;
		}
		const {resolve} = queueIterate.shift();
		resolve(data);
	});
	worker.addEventListener('messageerror', ({data}) => {
		if (queueIterate.length === 0) {
			queueMessage.push(['reject', data]);
			return;
		}
		const {reject} = queueIterate.shift();
		reject(data);
	});

	worker.postMessage([url, func, args]);

	return {
		next() {
			if (queueMessage.length > 0) {
				const [type, data] = queueMessage.shift();
				return Promise[type](data);
			}
			const promise = new Promise((resolve, reject) => queueIterate.push({resolve, reject}));
			return promise;
		},
		[Symbol.asyncIterator]() {
			return this;
		},
	};
};

if (import.meta.main) {
	///
///

// as worker
self.addEventListener('message', async ({data}) => {
	const [url, name, args] = data;
	const {[name]: func} = await import(url);
	self.postMessage(['exec', [name, ...args]]);
	for await (const result of func(...args)) {
		self.postMessage(['yield', result]);
	}
	self.postMessage(['done', [name, ...args]]);
});

///
	///
}
