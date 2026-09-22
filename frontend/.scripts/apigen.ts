/**
 * 起動中の backend から OpenAPI スキーマを取り、TypeScript の型を生成する。
 *
 *   cd frontend && npm run apigen
 *
 * 出力先は生成物なので直接編集しない。API を変えたら backend を起動し直して
 * このコマンドをやり直す。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outDir = outIndex >= 0 ? args[outIndex + 1] : './src/types/gen';
if (outDir == null) {
  throw new Error('--out を指定する');
}

const schemaUrl = process.env.OPENAPI_URL ?? 'http://localhost:4100/openapi.json';

const response = await fetch(schemaUrl);
if (!response.ok) {
  throw new Error(`OpenAPI スキーマを取得できない: ${schemaUrl} (${response.status})`);
}

const ast = await openapiTS(await response.json());
const contents = `// Generated from ${schemaUrl} by frontend/.scripts/apigen.ts. Do not edit.\n${astToString(ast)}`;

await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'api.ts');
await writeFile(outPath, contents, 'utf8');

console.log(`wrote ${outPath}`);
