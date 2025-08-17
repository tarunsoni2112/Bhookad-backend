require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Bhookad Backend API is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    uptime: process.uptime()
  });
});

// Sample vendors endpoint (without database for now)
app.get('/api/vendors', (req, res) => {
  const sampleVendors = [
    {
      id: 1,
      name: 'Sharma Ji Ka Dhaba',
      description: 'Authentic North Indian street food with 20+ years of experience',
      address: 'Connaught Place, Block A',
      city: 'delhi',
      cuisine_type: 'North Indian',
      rating: 4.5,
      specialties: ['Chole Bhature', 'Rajma Rice', 'Lassi'],
      verified: true
    },
    {
      id: 2,
      name: 'Mumbai Chaat Corner',
      description: 'Best Mumbai street chaat in Delhi',
      address: 'Karol Bagh Market',
      city: 'delhi',
      cuisine_type: 'Street Food',
      rating: 4.3,
      specialties: ['Pani Puri', 'Bhel Puri', 'Sev Puri'],
      verified: true
    }
  ];

  res.json({
    success: true,
    count: sampleVendors.length,
    vendors: sampleVendors
  });
});

// Sample contact endpoint
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, subject aur message required hain'
    });
  }

  // For now, just log the contact form data
  console.log('Contact form submission:', { name, email, subject, message });

  res.status(201).json({
    success: true,
    message: 'Thank you for contacting us! Hum 24 hours mein reply karenge.',
    submission_id: Date.now()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
console.log('🔄 Starting Bhookad Backend server...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 Attempting to start on port: ${PORT}`);

app.listen(PORT, () => {
  console.log(`🚀 Bhookad Backend server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`✅ Server started successfully!`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please kill the process or use a different port.`);
  }
  process.exit(1);
});

// Export for testing
module.exports = app;
