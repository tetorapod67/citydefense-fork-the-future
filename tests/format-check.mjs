import { readFile } from "node:fs/promises";

const files = [
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/app/login/login-form.tsx",
  "src/app/login/page.tsx",
  "src/app/play/city-defense-client.tsx",
  "src/app/play/page.tsx",
  "src/app/server/city-defense.ts",
  "src/db/schema.ts",
];

for (const file of files) {
  const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (text.includes("\t")) throw new Error(`${file}: tabs are not allowed`);
  if (!text.endsWith("\n")) throw new Error(`${file}: missing final newline`);
}

console.log(`PASS format-check (${files.length} files)`);
