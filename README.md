# postinstall-esbuild

This is a [postinstall](http://github.com/kapouer/postinstall) command plugin.

It runs `esbuild` on inputs, and concatenate bundles on output.

Supports iife js or css.

## Usage

The plugin can be called directly, or through `postinstall`.

Directly:

```js
require('postinstall-esbuild')(inputs, output, options).then(function() {
 // done
});
```

## Options

### browsers

A Browserslist query string

### minify

Pass `minify: false` to disable minification.

### Caveats

Support for source maps is not available and will be added eventually.
