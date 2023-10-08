const { dirname, basename, extname, relative } = require('node:path');
const { createReadStream } = require('node:fs');

const { build } = require("esbuild");
const { esbuildPluginBrowserslist } = require('esbuild-plugin-browserslist');
const browserslist = require('browserslist');
const { SourceMapGenerator } = require('source-map');
const { createInterface } = require('node:readline/promises');
const { buffer } = require('node:stream/consumers');
const { PassThrough } = require('node:stream');



module.exports = async function (inputs, output, options) {
	const isJS = extname(output) == ".js";

	const resolveDir = dirname(output);

	const esOpts = {
		sourcemap: true,
		sourcesContent: false,
		preserveSymlinks: true,
		stdin: {
			contents: null,
			resolveDir,
			sourcefile: basename(output)
		},
		outfile: output,
		write: true,
		allowOverwrite: true,
		minify: options.minify !== false,
		ignoreAnnotations: true,
		legalComments: 'none',
		plugins: [
			esbuildPluginBrowserslist(browserslist(options.browsers ?? 'defaults'), {
				printUnknownTargets: false
			})
		],
		loader: {
			'.js': 'js',
			'.css': 'css',
			'.ttf': 'copy',
			'.woff': 'copy',
			'.woff2': 'copy',
			'.eot': 'copy',
			'.svg': 'dataurl',
			'.png': 'copy',
			'.webp': 'copy'
		}
	};

	if (isJS) {
		// concatenation similar to postinstall-js
		esOpts.bundle = false;
		esOpts.stdin.loader = 'js';
		const sourceMap = new SourceMapGenerator({ file: output });
		const pt = new PassThrough();
		const consumer = buffer(pt);
		let offset = 0;
		for (const input of inputs) {
			let i = 0;
			const source = relative(resolveDir, input);
			const inputStream = createReadStream(input);
			for await (const line of createInterface({
				input: inputStream,
				crlfDelay: Infinity
			})) {
				i += 1;
				sourceMap.addMapping({
					source,
					original: {
						line: i,
						column: 0
					},
					generated: {
						line: offset + i,
						column: 0
					}
				});
				pt.write(line + '\n');
			}
			inputStream.close();
			offset += i;
		}
		pt.write(inlineMap(sourceMap));
		pt.end();
		esOpts.stdin.contents = await consumer;
	} else {
		esOpts.bundle = true;
		esOpts.stdin.loader = 'css';
		esOpts.stdin.contents = inputs.map(input => {
			const source = relative(resolveDir, input);
			return `@import "${source}";`;
		}).join('\n');
	}
	const result = await build(esOpts);
	const { errors, warnings } = result;
	if (errors.length) throw new Error(errors.join('\n'));
	if (warnings.length) console.warn(warnings.join('\n'));
};

function inlineMap(map) {
	return '//# sourceMappingURL=data:application/json;charset=utf-8;base64,' + Buffer.from(map.toString()).toString('base64');
}
