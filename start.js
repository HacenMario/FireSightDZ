// FireSightDZ — Local dev starter ( FIXED )
// ✅ لا حاجة لـ Python بعد الآن: مسار /proxy/* مدمج داخل server/server.js
// التشغيل:  node start.js   أو   npm start

const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'server', 'server.js');

console.log('🔥 FireSightDZ — Starting server...');
console.log('   (الـ Proxy لـ NASA FIRMS مدمج داخل السيرفر على نفس المنفذ)\n');

const node = spawn('node', [serverPath], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NODE_ENV: 'production' },
});

node.on('error', (err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});

node.on('exit', (code) => process.exit(code ?? 0));

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping server...');
  if (node && !node.killed) node.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
});
