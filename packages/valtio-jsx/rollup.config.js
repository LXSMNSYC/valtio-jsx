import babel from '@rollup/plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';

const plugins = [
  nodeResolve({
    extensions: ['.js', '.ts']
  }),
  babel({
    extensions: ['.js', '.ts'],
    babelHelpers: "bundled",
    presets: ["@babel/preset-typescript"],
    plugins: [
      [
        "babel-plugin-transform-rename-import",
        {
          original: "rxcore",
          replacement: "../../../packages/valtio-jsx/src/core"
        }
      ]
    ]
  })
];

export default [{
  input: 'src/index.ts',
  output: [{
    format: 'cjs',
    file: 'lib/index.js'
  }, {
    format: 'es',
    file: 'dist/index.js'
  }],
  external: ['valtio/vanilla', 'valtio/utils'],
  plugins
}, {
  input: 'src/html.ts',
  output: [{
    format: 'cjs',
    file: 'lib/html.js'
  }, {
    format: 'es',
    file: 'dist/html.js'
  }],
  external: ['./index', 'valtio/vanilla', 'valtio/utils'],
  plugins
}, {
  input: 'src/h.ts',
  output: [{
    format: 'cjs',
    file: 'lib/h.js'
  }, {
    format: 'es',
    file: 'dist/h.js'
  }],
  external: ['./index', 'valtio/vanilla', 'valtio/utils'],
  plugins
}];
