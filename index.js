const { dirname, basename, extname } = require('node:path');
const { promises: fs } = require('node:fs');

const { build } = require("esbuild");
const { esbuildPluginBrowserslist } = require('esbuild-plugin-browserslist');
const browserslist = require('browserslist');


module.exports = async function (inputs, output, options) {
	const isJS = extname(output) == ".js";

	const esOpts = {
		bundle: false,
		stdin: {
			contents: null,
			resolveDir: dirname(output),
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
			'.svg': 'data',
			'.png': 'copy',
			'.webp': 'copy'
		}
	};

	if (isJS) {
		esOpts.bundle = false;
		esOpts.stdin.loader = 'js';
		esOpts.stdin.contents = await Promise.all(inputs.map(async input => {
			const data = await fs.readFile(input);
			return `(() => {
				${data}
			})();`;
		}));
	} else {
		esOpts.bundle = true;
		esOpts.stdin.contents = inputs.map(input => {
			return `@import "${input}";`;
		}).join('\n');
	}

	const result = await build(esOpts);
	const { errors, warnings } = result;
	if (errors.length) throw new Error(errors.join('\n'));
	if (warnings.length) console.warn(warnings.join('\n'));
};
