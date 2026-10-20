import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript', 'prettier'],
    rules: {
      // Allow intentionally-unused identifiers when prefixed with an underscore
      // (placeholder args and ignored destructured values).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Item images are user-uploaded blob/Storage URLs rendered at small sizes;
      // next/image's optimizer adds no benefit here, so the raw <img> is intentional.
      '@next/next/no-img-element': 'off',
    },
  }),
  {
    ignores: ['.next/**', 'out/**', 'coverage/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default config;
