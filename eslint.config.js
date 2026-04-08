const tseslint = require('typescript-eslint');
const js = require('@eslint/js');

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'metro.config.js', 'babel.config.js', 'tailwind.config.js'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Enforce NativeWind: warn on StyleSheet.create
      'no-restricted-properties': [
        'warn',
        {
          object: 'StyleSheet',
          property: 'create',
          message:
            'Prefer NativeWind className over StyleSheet.create. Exceptions: Reanimated animated styles, navigator style props (tabBarStyle, etc.).',
        },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
      // React Native doesn't need display-name
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
