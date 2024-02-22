const Path = require('node:path');
const { readFile } = require('node:fs/promises');

const { build } = require("esbuild");
const { transform, browserslistToTargets } = require('lightningcss');
const { esbuildPluginBrowserslist } = require('esbuild-plugin-browserslist');
const browserslist = require('browserslist');

module.exports = async function (inputs, output, options = {}) {
	const isJS = Path.extname(output) == ".js";

	const resolveDir = Path.dirname(output);
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
			sourcefile: Path.basename(output)
		},
		bundle: true,
		outfile: output,
		write: true,
		allowOverwrite: true,
		minify: options.minify !== false,
		ignoreAnnotations: true,
		legalComments: 'none',
		plugins: [],
		loader: {
			'.js': 'js',
			'.css': 'css'
		}
	};
	if (options.cwd) esOpts.absWorkingDir = Path.resolve(options.cwd);

	if (isJS) {
		esOpts.plugins.push(esbuildPluginBrowserslist(browsers, {
			printUnknownTargets: false
		}));
		esOpts.stdin.loader = 'js';
		esOpts.stdin.contents = inputs.map(input => {
			if (Buffer.isBuffer(input)) {
				return input;
			} else if (/^https?:\/\//.test(input)) {
				return `require("${input}");`;
			} else {
				return `require("${relativePath(resolveDir, input)}");`
			}
		}).join('\n');
	} else {
		esOpts.plugins.push(copy(), http(userAgent), lightning({
			targets: browserslistToTargets(browsers)
		}));
		esOpts.stdin.loader = 'css';
		esOpts.stdin.contents = inputs.map(input => {
			if (Buffer.isBuffer(input)) {
				return input;
			} else if (/^https?:\/\//.test(input)) {
				return `@import "${input}";`;
			} else {
				return `@import "${relativePath(resolveDir, input)}";`;
			}
		}).join('\n');
	}

	const { errors, warnings } = await build(esOpts);
	if (errors.length) throw new Error(errors.join('\n'));
	if (warnings.length) console.warn(warnings.join('\n'));
};

function relativePath(from, to) {
	const str = Path.relative(from, to);
	if (/^\.?\//.test(str)) return str;
	else return './' + str;
}

function copy() {
	return {
		name: "copy",
		setup(build) {
			build.onLoad({ filter: /.*/, namespace: 'file' }, async (args) => {
				const ext = Path.extname(args.path);
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
				const mime = await import('mime/lite');
				const ext = mime.default.getExtension(contentType);
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

function lightning({ targets }) {
	return {
		name: "lightning",
		setup({ onResolve, onLoad, initialOptions }) {
			onLoad({ filter: /.\.css$/ }, async ({ path }) => {
				const { code } = transform({
					errorRecovery: false,
					filename: path,
					code: await readFile(path),
					minify: initialOptions.minify,
					targets,
				});
				return { contents: code, loader: 'css' };
			});
		}
	};
}
