// `npm run dev` at the repo root: starts the backend (4000) and the admin web (3000) in one terminal.
//
// Why not `concurrently`: on Windows, Ctrl+C reaches every process attached to the console. Each
// cmd.exe running a batch shim (npm.cmd, ts-node-dev.cmd, next.cmd) then asked "Terminate batch job
// (Y/N)?", and the shutdown lines were printed after PowerShell had already shown its prompt.
// Here each server tree runs in its own process group (`start /b` on Windows, `detached` elsewhere),
// which does not receive Ctrl+C. Only this script does; it stops both trees at once (`taskkill /T /F`,
// or SIGTERM to the group) and prints nothing more, so the terminal is clean when the prompt returns.
// If one server stops on its own, the other is stopped too.
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

const APPS = [
  { name: 'api', color: 34, args: ['--prefix', 'backend', 'run', 'start:dev'] },
  { name: 'web', color: 32, args: ['--prefix', 'apps/admin_web', 'run', 'dev'] },
];

const root = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
// npm sets npm_execpath for `npm run dev`; fall back to the npm bundled with this Node.
const npmCli =
  process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
// Output goes through a pipe, so keep the servers' colours on when this terminal has them.
const env = { ...process.env, FORCE_COLOR: process.stdout.isTTY ? '1' : (process.env.FORCE_COLOR ?? '0') };

let stopping = false;
const running = new Set();

function quote(arg) {
  return /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

function start(app) {
  const argv = [process.execPath, npmCli, ...app.args];
  const options = { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] };
  const child = isWindows
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"start "" /b /wait ${argv.map(quote).join(' ')}"`], {
        ...options,
        windowsVerbatimArguments: true,
      })
    : spawn(argv[0], argv.slice(1), { ...options, detached: true });

  const label = `\x1b[${app.color}m[${app.name}]\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) {
    readline.createInterface({ input: stream }).on('line', (line) => {
      if (!stopping) process.stdout.write(label + line + '\n');
    });
  }
  running.add(child);
  child.on('exit', () => {
    running.delete(child);
    if (!stopping) {
      process.stdout.write(`${label}stopped; stopping the other server too.\n`);
      stop(1);
    }
  });
}

function killTree(child) {
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
}

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of running) killTree(child);
}

// SIGINT = Ctrl+C, SIGHUP = terminal window closed (Windows), SIGTERM = stopped by another tool.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(0));

APPS.forEach(start);
