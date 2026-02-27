/**
 * Script: generate-beta-keys.ts
 * Usage:  npx ts-node scripts/generate-beta-keys.ts > beta-keys.sql
 *
 * Generates 100 beta keys and prints a ready-to-run INSERT SQL statement.
 * Paste the output into Supabase SQL Editor and run it there.
 */

import * as crypto from 'crypto';

const KEY_COUNT = 100;

function generateKey(): string {
    const segment = (): string =>
        crypto.randomBytes(2).toString('hex').toUpperCase();
    return `BETA-${segment()}-${segment()}-${segment()}`;
}

const now = new Date().toISOString();
const keys = Array.from({ length: KEY_COUNT }, () => generateKey());

const rows = keys
    .map((k) => `  ('${k}', true, '${now}')`)
    .join(',\n');

const sql = `INSERT INTO public.beta_keys (key, is_active, activated_at)
VALUES
${rows}
ON CONFLICT (key) DO NOTHING;`;

console.log(sql);
console.error(`\n✅  Generated ${KEY_COUNT} keys. Copy the SQL above into the Supabase SQL Editor and run it.`);
