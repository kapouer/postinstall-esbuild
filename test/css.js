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
			{ minify: true }
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
			{ minify: true, browsers: 'safari >= 12' }
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
			{minify: true}
		);
		const result = await fs.readFile(output);
		assert.ok(
			result.includes('body{font-size:16px}body{background:red}body{color:red}')
		);
		const obj = JSON.parse(await fs.readFile(__dirname + '/output/css/sampleBoth.css.map'));
		assert.deepEqual(obj.sources, ["../../css/sample1.css", "../../css/sample2.css"]);
		assert.ok(result.includes('/*# sourceMappingURL=sampleBoth.css.map */'));
	});
});
