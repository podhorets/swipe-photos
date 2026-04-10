import tseslint from 'typescript-eslint';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'metro.config.js', 'babel.config.js', 'tailwind.config.js'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
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
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
