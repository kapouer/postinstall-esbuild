const { dirname, basename, extname, relative } = require('node:path');
const { createReadStream } = require('node:fs');
const { readFile } = require('node:fs/promises');

const { build } = require("esbuild");
const { esbuildPluginBrowserslist } = require('esbuild-plugin-browserslist');
const browserslist = require('browserslist');
const { SourceMapGenerator } = require('source-map');
const { createInterface } = require('node:readline/promises');
const { buffer } = require('node:stream/consumers');
const { PassThrough } = require('node:stream');
const mime = require('mime/lite');

module.exports = async function (inputs, output, options = {}) {
	const isJS = extname(output) == ".js";

	const resolveDir = dirname(output);
	const sourceMap = options.sourceMap ?? false;

	const browsers = browserslist(options.browsers ?? 'defaults');
	const userAgent = browsersToUserAgent(browsers);

	const esOpts = {
		sourcemap: sourceMap,
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
			esbuildPluginBrowserslist(browsers, {
				printUnknownTargets: false
			})
		],
		loader: {
			'.js': 'js',
			'.css': 'css'
		}
	};

	if (isJS) {
		// concatenation similar to postinstall-js
		esOpts.bundle = false;
		esOpts.format = 'iife';
		esOpts.stdin.loader = 'js';
		let buf;
		if (sourceMap) {
			const pt = new PassThrough();
			const sourceMapGen = new SourceMapGenerator({ file: output });
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
					sourceMapGen.addMapping({
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
			pt.write(inlineMap(sourceMapGen));
			pt.end();
			buf = await buffer(pt);
		} else {
			const buffers = await Promise.all(inputs.map(input => {
				if (Buffer.isBuffer(input)) return input;
				else return readFile(input);
			}));
			buf = Buffer.concat(buffers);
		}
		esOpts.stdin.contents = buf;
	} else {
		esOpts.plugins.push(copy(), http(userAgent));
		esOpts.bundle = true;
		esOpts.stdin.loader = 'css';
		esOpts.stdin.contents = inputs.map(input => {
			if (/^https?:\/\//.test(input)) {
				return `@import "${input}";`;
			} else {
				return `@import "${relative(resolveDir, input)}";`;
			}

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

function copy() {
	return {
		name: "copy",
		setup(build) {
			build.onLoad({ filter: /.*/, namespace: 'file' }, async (args) => {
				const ext = extname(args.path);
				if (ext in build.initialOptions.loader) return;
				return {
					loader: "copy",
					contents: await readFile(args.path)
				};
			});
		}
	};
}

function http(userAgent) {
	return {
		name: "http",
		setup({ onResolve, onLoad, initialOptions }) {
			onResolve({ filter: /^https?:\/\// }, args => {
				return {
					path: args.path,
					namespace: "http-url"
				};
			});
			onResolve({ filter: /.*/, namespace: "http-url" }, args => {
				return {
					path: new URL(args.path, args.importer).toString(),
					namespace: "http-url"
				};
			});
			onLoad({ filter: /.*/, namespace: "http-url" }, async (args) => {
				const { path } = args;
				const response = await fetch(path, {
					headers: {
						'User-Agent': userAgent
					}
				});
				if (!response.ok) {
					return {
						errors: [{
							text: response.statusText,
							detail: response.status
						}]
					};
				}
				const contentType = response.headers.get('content-type');
				if (!contentType) {
					return {
						errors: [{
							text: 'Missing content-type',
							detail: new Error(path)
						}]
					};
				}
				const ext = mime.getExtension(contentType);
				if (!ext) {
					return {
						errors: [{
							text: 'Unknown content-type',
							detail: new Error(contentType)
						}]
					};
				}
				const loader = initialOptions.loader['.' + ext] ?? 'copy';
				const contents = new Uint8Array(await response.arrayBuffer());
				return { contents, loader };
			});
		}
	};
}

function browsersToUserAgent(browsers) {
	for (const browser of ['Firefox', 'Safari', 'Chrome']) {
		const lb = browser.toLowerCase();
		const minUa = browsers
			.filter(str => str.includes(lb))
			.map(str => parseFloat(str.replace(lb, '')))
			.sort((a, b) => a - b).shift();
		if (minUa) {
			return `Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 ${browser}/${minUa}.0`;
		}
	}
}
