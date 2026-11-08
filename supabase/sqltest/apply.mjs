import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
// MIG_DIR = supabase/migrations of the worktree under test
export const dir = process.env.MIG_DIR || path.join(here, '..', 'migrations');
export const NEW = '20261107_money_fixes_833.sql';
export async function build(log = console.log) {
  const db = new PGlite('memory://', { extensions: { pgcrypto, uuid_ossp } });
  await db.exec(fs.readFileSync(path.join(here, 'bootstrap.sql'), 'utf8'));
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && f !== NEW).sort();
  // pass 1 in filename order; failed files (atomic, rolled back) retried until fixpoint
  let pending = files, round = 0;
  while (pending.length && round < 6) {
    round++; const next = [];
    for (const f of pending) {
      try { await db.exec(fs.readFileSync(dir + '/' + f, 'utf8')); log(`round ${round} OK   ${f}`); }
      catch (e) { next.push(f); log(`round ${round} FAIL ${f} - ${e.message.split('\n')[0]}`); }
    }
    if (round === 1) { await db.exec(fs.readFileSync(path.join(here, 'stubs_missing.sql'), 'utf8')); log('applied stubs_missing.sql'); pending = next; continue; }
    if (next.length === pending.length) break; pending = next;
  }
  return { db, unresolved: pending };
}
