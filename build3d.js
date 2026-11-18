// Builds 3d/map3d.js, the 3D floor, from src3d/map3d.js and three.js. The models in 3d/ come from art/blender.
require('esbuild').buildSync({ entryPoints: ['src3d/map3d.js'], bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari15'], outfile: '3d/map3d.js', legalComments: 'none' });
console.log('built 3d/map3d.js', (require('fs').statSync('3d/map3d.js').size / 1024).toFixed(0), 'KB');
