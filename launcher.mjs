#!/usr/bin/env node
/**
 * Spawns and stops the Expense Tracker backend and frontend.
 * Used by start-helper.html (via .command files) and optionally from the CLI.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const PID_FILE = path.join(ROOT, '.launcher', 'pids.json');

function readPids() {
  if (!existsSync(PID_FILE)) return { backend: null, frontend: null };
  try {
    return JSON.parse(readFileSync(PID_FILE, 'utf-8'));
  } catch {
    return { backend: null, frontend: null };
  }
}

function writePids(pids) {
  mkdirSync(path.dirname(PID_FILE), { recursive: true });
  writeFileSync(PID_FILE, JSON.stringify(pids, null, 2));
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPid(pid) {
  if (!pid || !isAlive(pid)) return false;
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

function startBackend() {
  const pids = readPids();
  if (isAlive(pids.backend)) return false;

  const proc = spawn('node', ['--watch', 'server.js'], {
    cwd: SERVER_DIR,
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();
  pids.backend = proc.pid;
  writePids(pids);
  return true;
}

function startFrontend() {
  const pids = readPids();
  if (isAlive(pids.frontend)) return false;
  if (!existsSync(VITE_BIN)) {
    console.error('Vite not found. Run: npm install');
    process.exit(1);
  }

  const proc = spawn('node', [VITE_BIN], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();
  pids.frontend = proc.pid;
  writePids(pids);
  return true;
}

function stopBackend() {
  const pids = readPids();
  const stopped = killPid(pids.backend);
  pids.backend = null;
  writePids(pids);
  return stopped;
}

function stopFrontend() {
  const pids = readPids();
  const stopped = killPid(pids.frontend);
  pids.frontend = null;
  writePids(pids);
  return stopped;
}

function startServers() {
  const started = [];
  if (startBackend()) started.push('backend');
  if (startFrontend()) started.push('frontend');
  return started;
}

function stopServers() {
  const stopped = [];
  if (stopFrontend()) stopped.push('frontend');
  if (stopBackend()) stopped.push('backend');
  return stopped;
}

function getStatus() {
  const pids = readPids();
  const backend = isAlive(pids.backend);
  const frontend = isAlive(pids.frontend);
  if (!backend && pids.backend) {
    pids.backend = null;
    writePids(pids);
  }
  if (!frontend && pids.frontend) {
    pids.frontend = null;
    writePids(pids);
  }
  return { backend, frontend };
}

const command = process.argv[2];

switch (command) {
  case 'start': {
    const started = startServers();
    if (started.length) console.log('Started:', started.join(', '));
    else console.log('Servers were already running.');
    break;
  }
  case 'stop': {
    const stopped = stopServers();
    if (stopped.length) console.log('Stopped:', stopped.join(', '));
    else console.log('Servers were already stopped.');
    break;
  }
  case 'status': {
    const status = getStatus();
    console.log(JSON.stringify(status));
    break;
  }
  default:
    console.log('Usage: node launcher.mjs <start|stop|status>');
    process.exit(command ? 1 : 0);
}
