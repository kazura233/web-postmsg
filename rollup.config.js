import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'
import babel from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import { defineConfig } from 'rollup'

import pkg from './package.json' assert { type: 'json' }

const extensions = ['.ts']

const noDeclarationFiles = { compilerOptions: { declaration: false } }

const babelRuntimeVersion = pkg.dependencies['@babel/runtime'].replace(/^[^0-9]*/, '')

const kebabToPascal = (kebabCase) =>
  kebabCase.replace(/(^|-)(\w)/g, (_, __, char) => char.toUpperCase())

const umdBundleNameToRollupOptions = (bundle, isDev = true) => {
  const plugins = [
    json(),
    resolve({ extensions }),
    typescript({ tsconfigOverride: noDeclarationFiles }),
    babel({
      extensions,
      plugins: [['@babel/plugin-transform-runtime', { version: babelRuntimeVersion }]],
      babelHelpers: 'runtime',
      exclude: 'node_modules/**',
    }),
    commonjs(),
    replace({
      'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
      preventAssignment: true,
    }),
  ]

  !isDev && plugins.push(terser())

  const options = {
    input: `src/${bundle}.ts`,
    output: {
      file: `dist/${bundle}${isDev ? '' : '.min'}.js`,
      format: 'umd',
      name: kebabToPascal(bundle),
      indent: false,
      exports: 'default',
      globals: {
        WebPostMsg: 'WebPostMsg',
      },
    },
    plugins,
  }

  return options
}

export default defineConfig([
  // CommonJS
  {
    input: ['src/web-postmsg.ts', 'src/frame-window-reference.ts', 'src/open-window-reference.ts'],
    output: {
      dir: 'lib',
      format: 'cjs',
      indent: false,
      exports: 'default',
    },
    external: [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)],
    plugins: [
      json(),
      resolve({
        extensions,
      }),
      typescript({
        useTsconfigDeclarationDir: true,
      }),
      babel({
        extensions,
        plugins: [['@babel/plugin-transform-runtime', { version: babelRuntimeVersion }]],
        babelHelpers: 'runtime',
      }),
      commonjs(),
    ],
  },
  // ES
  {
    input: 'src/index.ts',
    output: {
      file: 'es/web-postmsg.js',
      format: 'es',
      indent: false,
    },
    external: [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)],
    plugins: [
      json(),
      resolve({
        extensions,
      }),
      typescript({ tsconfigOverride: noDeclarationFiles }),
      babel({
        extensions,
        plugins: [
          ['@babel/plugin-transform-runtime', { version: babelRuntimeVersion, useESModules: true }],
        ],
        babelHelpers: 'runtime',
      }),
      commonjs(),
    ],
  },
  // UMD Development
  ...['web-postmsg', 'frame-window-reference', 'open-window-reference'].map((bundle) =>
    umdBundleNameToRollupOptions(bundle)
  ),

  // UMD Production
  ...['web-postmsg', 'frame-window-reference', 'open-window-reference'].map((bundle) =>
    umdBundleNameToRollupOptions(bundle, false)
  ),
])
