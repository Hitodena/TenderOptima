// Development server runner
// This script starts both the server and client components with proper configuration

import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Function to check if port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
}

// Function to find an available port starting from a given port
async function findAvailablePort(startPort) {
  let port = startPort;
  while (port < startPort + 100) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error(`No available ports found starting from ${startPort}`);
}

console.log('🚀 Starting SupplierFinder development environment...');

// Main startup function
async function startDevelopmentEnvironment() {
  try {
    // Use port 5000 for Express server (required for Replit)
    console.log('📡 Starting Express server on port 5000...');
    const serverPort = 5000;
    
    // Start server process
    const serverProcess = spawn('tsx', ['server/index.ts'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: { 
        ...process.env,
        NODE_ENV: 'development',
        PORT: '5000'
      }
    });
    
    serverProcess.on('error', (error) => {
      console.error(`[Server Error] Failed to start server: ${error.message}`);
    });
    
    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Find available port for Vite client
    console.log('🌐 Finding available port for Vite client...');
    const clientPort = await findAvailablePort(serverPort + 1);
    console.log(`🌐 Starting Vite client on port ${clientPort}...`);
    
    // Start client with correct proxy configuration
    const clientProcess = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', clientPort.toString()], {
      cwd: __dirname,
      stdio: 'inherit',
      env: { 
        ...process.env,
        NODE_ENV: 'development',
        VITE_SERVER_PORT: serverPort.toString()
      }
    });
    
    clientProcess.on('error', (error) => {
      console.error(`[Client Error] Failed to start client: ${error.message}`);
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down development environment...');
      if (serverProcess) serverProcess.kill();
      if (clientProcess) clientProcess.kill();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down development environment...');
      if (serverProcess) serverProcess.kill();
      if (clientProcess) clientProcess.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start development environment:', error.message);
    process.exit(1);
  }
}

// Start the development environment
startDevelopmentEnvironment();