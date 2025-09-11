// Unified development server script
import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Starting SupplierFinder development environment...');

// Start the server
const serverProcess = spawn('tsx', ['server/index.ts'], {
  cwd: __dirname,
  stdio: 'pipe',
  env: { ...process.env }
});

// Buffer for collecting server output
let serverStarted = false;
let serverBuffer = '';

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverBuffer += output;
  process.stdout.write(`[Server] ${output}`);
  
  // Check if server is started
  if (output.includes('serving on port 5000')) {
    serverStarted = true;
    startClient();
  }
});

serverProcess.stderr.on('data', (data) => {
  process.stderr.write(`[Server Error] ${data.toString()}`);
});

// Function to start the client after server is ready
function startClient() {
  console.log('Server started, now starting client...');
  
  // Start Vite client with specific configuration
  const clientProcess = spawn('npx', ['vite', '--port', '5000', '--host', '0.0.0.0', '--strictPort', 'false'], {
    cwd: resolve(__dirname, 'client'),
    stdio: 'pipe',
    env: { ...process.env }
  });
  
  clientProcess.stdout.on('data', (data) => {
    process.stdout.write(`[Client] ${data.toString()}`);
  });
  
  clientProcess.stderr.on('data', (data) => {
    process.stderr.write(`[Client Error] ${data.toString()}`);
  });
  
  clientProcess.on('exit', (code) => {
    console.log(`Client process exited with code ${code}`);
    serverProcess.kill();
    process.exit(code);
  });
}

// Start client if server doesn't report ready within 10 seconds
setTimeout(() => {
  if (!serverStarted) {
    console.log('Server didn\'t report startup within expected time, starting client anyway...');
    startClient();
  }
}, 10000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  serverProcess.kill();
  process.exit(0);
});