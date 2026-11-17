import tseslint from "typescript-eslint";
import noComments from "./tools/eslint/no-comments.js";

export default [
  { ignores: ["node_modules/", "dist/"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
    plugins: { local: { rules: { "no-comments": noComments } } },
    rules: { "local/no-comments": "error" },
  },
];
