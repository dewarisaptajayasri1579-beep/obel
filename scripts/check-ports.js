// Runs before `npm run dev` (npm "predev" hook): refuse to start when the dev ports are already
// taken, instead of letting one server come up half-way (Next.js silently moves to 3001, the
// backend dies with EADDRINUSE and the web then talks to an old backend).
//
// Checks by connecting, not binding, so it works the same on Windows, macOS and Linux and has no
// dependencies (the root package has none besides concurrently).
const net = require('node:net');

// Defaults of the two apps (backend PORT in backend/.env.example, `next dev`).
const PORTS = [
  { port: 4000, name: 'backend (API)' },
  { port: 3000, name: 'admin web' },
];

function isListening(port) {
  const targets = ['127.0.0.1', '::1'];
  return Promise.all(
    targets.map(
      (host) =>
        new Promise((resolve) => {
          const socket = net.connect({ port, host });
          socket.setTimeout(700);
          socket.once('connect', () => (socket.destroy(), resolve(true)));
          socket.once('timeout', () => (socket.destroy(), resolve(false)));
          socket.once('error', () => resolve(false));
        }),
    ),
  ).then((results) => results.some(Boolean));
}

function hint(port) {
  return process.platform === 'win32'
    ? `  Cek prosesnya : Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object OwningProcess\n` +
        '  Matikan       : Stop-Process -Id <PID>   (atau taskkill /PID <PID> /T /F)'
    : `  Matikan       : kill $(lsof -ti tcp:${port})`;
}

(async () => {
  const busy = [];
  for (const target of PORTS) {
    if (await isListening(target.port)) busy.push(target);
  }
  if (busy.length === 0) return;

  console.error('');
  for (const { port, name } of busy) {
    console.error(`x Port ${port} (${name}) sudah dipakai proses lain.`);
    console.error(hint(port));
  }
  console.error('');
  console.error('Biasanya itu sisa `npm run dev` sebelumnya yang belum berhenti. Matikan dulu, lalu jalankan lagi.');
  console.error('');
  process.exit(1);
})();
