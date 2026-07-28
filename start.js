const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
};

function log(prefix, message, color = colors.blue) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${color}[${timestamp}] ${prefix}${colors.reset} ${message}`);
}

function checkFiles() {
    const proxyPath = path.join(__dirname, 'proxy.py');
    const serverPath = path.join(__dirname, 'server', 'server.js');
    if (!fs.existsSync(proxyPath)) {
        console.error(`${colors.red}❌ proxy.py not found${colors.reset}`);
        process.exit(1);
    }
    if (!fs.existsSync(serverPath)) {
        console.error(`${colors.red}❌ server/server.js not found${colors.reset}`);
        process.exit(1);
    }
    return { proxyPath, serverPath };
}

function runProxy(proxyPath) {
    log('[PROXY]', 'Starting Proxy server...', colors.cyan);
    const proxy = spawn('python', [proxyPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    proxy.stdout.on('data', (data) => {
        data.toString().split('\n').filter(Boolean).forEach(line => log('[PROXY]', line, colors.green));
    });

    proxy.stderr.on('data', (data) => {
        data.toString().split('\n').filter(Boolean).forEach(line => log('[PROXY]', line, colors.yellow));
    });

    proxy.on('error', (err) => log('[PROXY]', `Error: ${err.message}`, colors.red));
    return proxy;
}

function runNodeServer(serverPath) {
    log('[NODE]', 'Starting Notification server...', colors.cyan);
    const node = spawn('node', [serverPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        cwd: path.dirname(serverPath),
        env: { ...process.env, NODE_ENV: 'development' },
    });

    node.stdout.on('data', (data) => {
        data.toString().split('\n').filter(Boolean).forEach(line => log('[NODE]', line, colors.blue));
    });

    node.stderr.on('data', (data) => {
        data.toString().split('\n').filter(Boolean).forEach(line => log('[NODE]', line, colors.yellow));
    });

    node.on('error', (err) => log('[NODE]', `Error: ${err.message}`, colors.red));
    return node;
}

async function main() {
    console.log(`${colors.bright}🔥 Wildfire Alert System - Starting Servers${colors.reset}`);
    console.log('============================================\n');

    const { proxyPath, serverPath } = checkFiles();

    const proxyProcess = runProxy(proxyPath);
    const nodeProcess = runNodeServer(serverPath);

    process.on('SIGINT', () => {
        console.log(`\n${colors.yellow}🛑 Stopping servers...${colors.reset}`);
        [proxyProcess, nodeProcess].forEach(p => { if (p && !p.killed) p.kill('SIGTERM'); });
        setTimeout(() => process.exit(0), 1000);
    });

    console.log(`\n${colors.green}✅ All servers running!${colors.reset}`);
    console.log(`   📡 Proxy: http://localhost:8080`);
    console.log(`   🚀 Node Server: http://localhost:3000`);
    console.log(`   🌍 Open browser: http://localhost:3000\n`);
    console.log(`${colors.yellow}⏹️  Press Ctrl+C to stop all servers${colors.reset}`);

    await new Promise(() => {});
}

main();