import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { connect } from './db/client';
import { describeRepository } from './test-utils/repository-suite';

describeRepository('SQLite (libsql, temp file)', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'goc-repo-sqlite-'));
  const handle = await connect({ dialect: 'sqlite', url: `file:${path.join(dir, 'test.db')}` });
  return {
    handle,
    cleanup: async () => {
      await handle.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
});
