const http = require('http');
const net = require('net');

// Service endpoints to check
const services = [
  { name: 'MCP Server', host: 'localhost', port: 3000, path: '/health' },
  { name: 'Ollama', host: 'localhost', port: 11434, path: '/api/version' },
  { name: 'MongoDB', host: 'localhost', port: 27017 },
  { name: 'Orchestrator', host: 'localhost', port: 3005, path: '/health' }
];

function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

function checkHttpService(host, port, path) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: port,
      path: path,
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      resolve({ available: true, status: res.statusCode });
    });

    req.on('error', () => {
      resolve({ available: false, status: null });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ available: false, status: null });
    });

    req.setTimeout(2000);
    req.end();
  });
}

async function checkServices() {
  console.log('🔍 Checking service status...\n');
  
  for (const service of services) {
    process.stdout.write(`Checking ${service.name}... `);
    
    if (service.path) {
      // HTTP service check
      const result = await checkHttpService(service.host, service.port, service.path);
      if (result.available) {
        console.log(`✅ Running (HTTP ${result.status})`);
      } else {
        console.log(`❌ Not accessible`);
      }
    } else {
      // Simple port check (for MongoDB)
      const isOpen = await checkPort(service.host, service.port);
      console.log(isOpen ? '✅ Port open' : '❌ Port closed');
    }
  }
  
  console.log('\n📋 Service Status Summary:');
  console.log('- MCP Server should be running on port 3000');
  console.log('- Ollama should be running on port 11434');
  console.log('- MongoDB should be running on port 27017');
  console.log('- Orchestrator should be running on port 3005');
  
  console.log('\n🚀 To start services:');
  console.log('1. Start MongoDB: mongod (or use Docker)');
  console.log('2. Start Ollama: ollama serve');
  console.log('3. Start MCP Server: cd mcp-server && npm start');
  console.log('4. Start Orchestrator: cd orchestrator && npm start');
}

checkServices().catch(console.error); 