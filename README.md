# postinstall-esbuild

This is a [postinstall](http://github.com/kapouer/postinstall) command plugin.

It runs `esbuild` on inputs, and concatenate bundles on output.

Supports Buffer, remote URL, or local paths.

Bundles remote dependencies, otherwise assets are copied.

## Usage

The plugin can be called directly, or through `postinstall`.

Directly:

```js
await require('postinstall-esbuild')(inputs, output, options);
```

## Options

### browsers

A Browserslist query string

A user-agent header matching minimum browsers version is generated for the remote http calls, if any.

### minify

Pass `minify: false` to disable minification.

### sourceMap

Pass `sourceMap: true` to output "*.map" source maps.

Pass `sourceMap: false` to disable and allow passing Buffers in inputs.

For now, css source maps might not be correct (lightning does not pass map to esbuild).

### cwd

Change working directory.
