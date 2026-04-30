import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const analyticsRules = require("./eslint-rules/index.cjs");

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default tseslint.config(
  {
    ignores: [".next", "eslint-rules", "src/generated"],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      analytics: analyticsRules,
    },
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "react",
              importNames: ["useState", "useEffect"],
              message:
                "Prefer query/mutation states, react-hook-form, or server props over useState/useEffect. See CLAUDE.md.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/page.tsx"],
    rules: {
      "analytics/require-hydrate-client": "warn",
    },
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "analytics/no-anchor-tags": "error",
      "analytics/no-window-location": "error",
    },
  },
  {
    files: ["src/app/**/*.ts", "src/app/**/*.tsx", "src/server/api/routers/**/*.ts"],
    rules: {
      "analytics/no-type-assertion": "warn",
    },
  },
  {
    files: ["src/app/**/*.tsx", "src/app/**/*.ts", "src/components/**/*.tsx", "src/components/**/*.ts"],
    ignores: ["src/app/api/**/*"],
    rules: {
      "analytics/no-raw-fetch": "error",
    },
  },
  {
    files: ["src/components/**/*.tsx", "src/app/**/_components/**/*.tsx"],
    rules: {
      "analytics/single-component-per-file": "warn",
    },
  },
  {
    files: ["src/components/**/*.tsx", "src/app/**/_components/**/*.tsx"],
    ignores: ["src/components/ui/**/*.tsx"],
    rules: {
      "analytics/no-hardcoded-colors": "warn",
    },
  },

  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
