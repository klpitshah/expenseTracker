import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = join(__dirname, '..', '..', '..', 'scripts');
const PYTHON_PATH = join(SCRIPTS_DIR, 'venv', 'bin', 'python');
const SYNC_SCRIPT = join(SCRIPTS_DIR, 'origin_sync.py');

/** @type {import('../types.js').SyncProvider} */
export const originProvider = {
  id: 'origin',
  name: 'Origin',
  description: 'Browser-based sync from Origin Financial',

  async launch() {
    if (!existsSync(PYTHON_PATH)) {
      throw new Error(
        'Python venv not found. Run: cd scripts && python3 -m venv venv && source venv/bin/activate && pip install selenium selenium-wire requests',
      );
    }
    if (!existsSync(SYNC_SCRIPT)) {
      throw new Error('Origin sync script not found');
    }

    const proc = spawn(PYTHON_PATH, [SYNC_SCRIPT], {
      cwd: SCRIPTS_DIR,
      detached: true,
      stdio: 'inherit',
    });

    proc.unref();

    return {
      success: true,
      provider: 'origin',
      message: 'Browser sync started. Log in to Origin in the browser window that opens.',
      pid: proc.pid,
    };
  },
};
