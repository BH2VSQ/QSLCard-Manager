import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';

console.log('🚀 Starting QSL Manager...');

// 启动后端服务器
const backend = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: false,
  windowsHide: true
});

// 启动前端开发服务器
// Windows 下需要使用 shell 来执行 .cmd 文件，但设置 windowsHide 隐藏窗口
const vitePath = path.join(__dirname, 'node_modules', '.bin', 'vite');
const frontend = spawn(isWindows ? 'cmd' : vitePath, 
  isWindows ? ['/c', 'vite', '--host', '0.0.0.0', '--port', '7054'] : ['--host', '0.0.0.0', '--port', '7054'], 
  {
    cwd: __dirname,
    stdio: 'inherit',
    shell: false,
    windowsHide: true
  }
);

// 处理进程退出
const cleanup = (code) => {
  console.log('\n🛑 Shutting down...');
  backend.kill();
  frontend.kill();
  process.exit(code);
};

backend.on('exit', (code) => {
  if (code !== 0) {
    console.error('❌ Backend process exited with code', code);
    cleanup(code);
  }
});

frontend.on('exit', (code) => {
  if (code !== 0) {
    console.error('❌ Frontend process exited with code', code);
    cleanup(code);
  }
});

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));


