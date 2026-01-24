import tseslint from "@typescript-eslint/eslint-plugin"
import tsparser from "@typescript-eslint/parser"
import globals from "globals"

export default [
  // Global ignores
  {
    ignores: ["**/dist/**", "**/.confucius/**", "**/node_modules/**", "**/*.d.ts"]
  },

  // TypeScript files with type-aware linting (src only)
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json"
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      // Hard correctness - block runtime errors
      "eqeqeq": ["error", "always"],
      "no-undef": "error",
      "no-unreachable": "error",
      "no-debugger": "error",

      // Prefer TS versions
      "no-unused-vars": "off",
      "no-redeclare": "off",

      // Real async bugs (errors - these break at runtime)
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",

      // TS correctness
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-redeclare": "error",

      // Cleanup rules (warnings - pay down debt gradually)
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": ["warn", { "prefer": "type-imports" }],

      // Allow console for CLIs and workers
      "no-console": "off"
    }
  },

  // Test files - relaxed rules, no type-aware linting
  {
    files: ["test/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: { ...globals.node }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "no-console": "off"
    }
  },

  // JavaScript files (mjs, cjs) - no TS parser
  {
    files: ["**/*.mjs", "**/*.cjs", "**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: {
      "eqeqeq": ["error", "always"],
      "no-undef": "error",
      "no-unreachable": "error",
      "no-console": "off"
    }
  }
]
