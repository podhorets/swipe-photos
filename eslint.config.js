import tseslint from 'typescript-eslint';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'metro.config.js', 'babel.config.js', 'tailwind.config.js', 'plugins/**'],
  },
  {
    // Node scripts (theme audit)
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { URL: 'readonly', console: 'readonly', process: 'readonly' } },
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
      // Theme rules (CLAUDE.md): outline icons come from components/ui/Icon,
      // surfaces are solid themed cards — no icon fonts, no frosted glass
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@expo/vector-icons', message: 'Use <Icon> from @/components/ui/Icon (draw missing icons there).' },
            { name: 'expo-blur', message: 'No frosted glass in the redesign: use Card / theme tokens.' },
          ],
          patterns: [
            { group: ['@expo/vector-icons/*'], message: 'Use <Icon> from @/components/ui/Icon (draw missing icons there).' },
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
