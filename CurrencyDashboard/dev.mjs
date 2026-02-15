import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const backend = spawn(process.execPath, ['server.mjs'], {
  stdio: 'inherit'
});

const viteScript = resolve('node_modules', 'vite', 'bin', 'vite.js');

const frontend = spawn(process.execPath, [viteScript, '--host', '0.0.0.0'], {
  stdio: 'inherit'
});

let stopping = false;

const stopAll = (signal = 'SIGTERM') => {
  if (stopping) return;
  stopping = true;
  backend.kill(signal);
  frontend.kill(signal);
};

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));

backend.on('exit', (code) => {
  if (!stopping) {
    stopAll();
    process.exit(code ?? 1);
  }
});

frontend.on('exit', (code) => {
  if (!stopping) {
    stopAll();
    process.exit(code ?? 1);
  }
});
