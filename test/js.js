const assert = require('node:assert').strict;
const { promises: fs } = require('fs');

const pjs = require('..');

describe("js bundling", () => {
	before(async () => {
		await fs.rm(__dirname + '/output/js', { recursive: true, force: true });
		await fs.mkdir(__dirname + '/output/js', { recursive: true });
	});
	it("bundles independent files", async () => {
		const inputs = [__dirname + '/js/sample1.js', __dirname + '/js/sample2.js'];
		const output = __dirname + '/output/js/sample.js';
		await pjs(
			inputs,
			output,
			{}
		);
		const result = await fs.readFile(output);
		assert.ok(result.includes('coco'));
		assert.ok(result.includes('caca'));
		assert.ok(result.includes('//# sourceMappingURL=sample.js.map'));
	});

	it("bundles independent files without sourceMap", async () => {
		const inputs = [__dirname + '/js/sample1.js', __dirname + '/js/sample2.js'];
		const output = __dirname + '/output/js/sample.js';
		await pjs(
			inputs,
			output,
			{sourceMap: false}
		);
		const result = await fs.readFile(output);
		assert.ok(result.includes('coco'));
		assert.ok(result.includes('caca'));
		assert.ok(!result.includes('//# sourceMappingURL=sample.js.map'));
	});

	it("bundles independent files without sourceMap and with an error", async () => {
		const inputs = [__dirname + '/js/sample1.js', __dirname + '/js/sampleFail.js'];
		const output = __dirname + '/output/js/sample.js';
		await assert.rejects(async () => pjs(
			inputs,
			output,
			{ sourceMap: false }
		), {
			name: 'Error',
			code: 'ENOENT'
		});
	});

	it("bundles with async support", async () => {
		const inputs = [__dirname + '/js/sample3.js'];
		const output = __dirname + '/output/js/sample3.js';
		await pjs(
			inputs,
			output,
			{ browsers: "defaults and not dead and not firefox < 53" }
		);
		const result = await fs.readFile(output);
		assert.ok(result.includes('coco'));
		assert.ok(result.includes('/test'));
		assert.ok(result.includes('//# sourceMappingURL=sample3.js.map'));
	});
});
