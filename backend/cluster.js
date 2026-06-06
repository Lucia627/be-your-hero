const cluster = require('cluster');
const os = require('os');

const NUM_WORKERS = Math.min(os.cpus().length, 8); // 最多8个worker，避免过多

if (cluster.isPrimary) {
  console.log(`[Cluster] Primary ${process.pid} starting ${NUM_WORKERS} workers...`);
  
  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`[Cluster] Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Cluster] SIGTERM received, shutting down workers...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }
  });
  
} else {
  require('./server');
  console.log(`[Cluster] Worker ${process.pid} started`);
}
