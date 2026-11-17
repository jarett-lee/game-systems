import { test } from "node:test";
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import noComments from "./no-comments.js";

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser },
  linterOptions: { noInlineConfig: true },
});
const error = { messageId: "noComments" };

test("no-comments", () => {
  ruleTester.run("no-comments", noComments, {
    valid: [
      "const damage = base * multiplier;",
      "const url = 'https://example.com/a//b';",
      String.raw`const pattern = /\/\*/;`,
      "type Cell = { x: number; y: number };",
    ],
    invalid: [
      { code: "// explain\nconst a = 1;", errors: [error] },
      { code: "const a = 1; // trailing", errors: [error] },
      { code: "/* block */ const a = 1;", errors: [error] },
      { code: "/** jsdoc */\nfunction f() {}", errors: [error] },
      { code: "// @ts-expect-error\nconst a: number = 'x';", errors: [error] },
      {
        code: "// eslint-disable-next-line local/no-comments\nconst a = 1;",
        errors: [{ message: /noInlineConfig/ }, error],
      },
      { code: "/// <reference types=\"vite/client\" />\nconst a = 1;", errors: [error] },
      { code: "// one\n// two\nconst a = 1;", errors: [error, error] },
    ],
  });
});
