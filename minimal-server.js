const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Minimal server working', timestamp: new Date().toISOString() });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Minimal server health check' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Minimal server running on port ${PORT}`);
  console.log(`Test: http://localhost:${PORT}/api/test`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
