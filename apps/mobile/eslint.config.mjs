import base from '@mrd/config/eslint/base';

export default [
  { ignores: ['.expo/**', 'web-build/**', 'metro.config.js', 'babel.config.js'] },
  ...base,
];
