import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**"] },
  {
    rules: {
      // The API doesn't export a generated/shared response-type contract, so
      // admin CRUD screens intentionally type raw JSON payloads as `any`
      // rather than hand-maintaining parallel interfaces that would drift.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
