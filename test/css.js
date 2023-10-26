const assert = require('node:assert').strict;
const { promises: fs } = require('fs');

const pjs = require('..');

describe("css bundling", () => {
	before(async () => {
		await fs.rm(__dirname + '/output/css', { recursive: true, force: true });
		await fs.mkdir(__dirname + '/output/css', { recursive: true });
	});
	it("bundles one file", async () => {
		const inputs = [__dirname + '/css/sample.css'];
		const output = __dirname + '/output/css/sample.css';
		await pjs(
			inputs,
			output,
			{ minify: true, sourceMap: true }
		);
		const result = await fs.readFile(output);
		assert.ok(
			result.includes('body{font-size:16px}body{background:red}body{color:red}')
		);
		assert.ok(result.includes('/*# sourceMappingURL=sample.css.map */'));
	});
	it("autoprefixes", async () => {
		const inputs = [__dirname + '/css/auto.css'];
		const output = __dirname + '/output/css/auto.css';
		await pjs(
			inputs,
			output,
			{ minify: true, browsers: 'safari >= 12', sourceMap: true }
		);
		const result = await fs.readFile(output);
		assert.ok(
			result.includes('div{position:-webkit-sticky;position:sticky}')
		);
		assert.ok(result.includes('/*# sourceMappingURL=auto.css.map */'));
	});
	it("bundles independent files", async () => {
		const inputs = [__dirname + '/css/sample1.css', __dirname + '/css/sample2.css'];
		const output = __dirname + '/output/css/sampleBoth.css';
		await pjs(
			inputs,
			output,
			{ minify: true, sourceMap: true }
		);
		const result = await fs.readFile(output);
		assert.ok(
			result.includes('body{font-size:16px}body{background:red}body{color:red}')
		);
		const obj = JSON.parse(await fs.readFile(__dirname + '/output/css/sampleBoth.css.map'));
		assert.deepEqual(obj.sources, [
			"../../css/sample1.css",
			"../../css/sample2.css"
		]);
		assert.ok(result.includes('/*# sourceMappingURL=sampleBoth.css.map */'));
	});
	it("keeps correct paths in symlinks", async () => {
		const inputs = [__dirname + '/css/sub.css'];
		const output = __dirname + '/output/css/sub.css';
		await pjs(
			inputs,
			output,
			{ sourceMap: true }
		);
		const obj = JSON.parse(await fs.readFile(__dirname + '/output/css/sub.css.map'));
		assert.deepEqual(obj.sources, [
			"../../css/sub.css"
		]);
	});

	it("bundles remote files and pulls non-variable fonts", async () => {
		const inputs = [__dirname + '/css/remote.css'];
		const output = __dirname + '/output/css/remote.css';
		await pjs(
			inputs,
			output,
			{ minify: false, browsers: 'firefox 61' }
		);
		const result = await fs.readFile(output);
		assert.ok(result.includes('font-weight: 800'));
		const fonts = new Set(result.toString().match(/[-\w]+\.woff2/g) ?? []);
		assert.equal(fonts.size, 6);
	}).timeout(15000);

	it("bundles remote files and pulls variable fonts", async () => {
		const inputs = [__dirname + '/css/remote.css'];
		const output = __dirname + '/output/css/remote.css';
		await pjs(
			inputs,
			output,
			{ minify: false, browsers: 'defaults' }
		);
		const result = await fs.readFile(output);
		assert.ok(result.includes('font-weight: 800'));
		const fonts = new Set(result.toString().match(/[-\w]+\.woff2/g) ?? []);
		assert.equal(fonts.size, 3);
	}).timeout(15000);

	it("bundles one file and its image", async () => {
		const inputs = [__dirname + '/css/sample3.css'];
		const output = __dirname + '/output/css/sample3.css';
		await pjs(
			inputs,
			output,
			{ minify: false, sourceMap: false }
		);
		const result = await fs.readFile(output);
		assert.ok(
			result.includes('background-image')
		);
		const filename = result.toString().match(/test-.*\.png/)[0];
		await assert.doesNotReject(async () => {
			await fs.access(__dirname + '/output/css/' + filename);
		});
	});
});
