const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { supabase } = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bhookad Backend API is running!',
    status: 'success',
    timestamp: new Date().toISOString()
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

// Test route first
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Bhookad Backend API is working!',
    timestamp: new Date().toISOString()
  });
});

// API Routes - Load one by one to identify issue
console.log('Loading routes...');

try {
  console.log('Loading auth routes...');
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Auth routes error:', error.message);
}

try {
  console.log('Loading vendor routes...');
  app.use('/api/vendors', require('./routes/vendors'));
  console.log('✅ Vendor routes loaded');
} catch (error) {
  console.error('❌ Vendor routes error:', error.message);
}

try {
  console.log('Loading contact routes...');
  app.use('/api/contact', require('./routes/contact'));
  console.log('✅ Contact routes loaded');
} catch (error) {
  console.error('❌ Contact routes error:', error.message);
}

try {
  console.log('Loading vlogger posts routes...');
  app.use('/api/vlogger-posts', require('./routes/vlogger-posts'));
  console.log('✅ Vlogger posts routes loaded');
} catch (error) {
  console.error('❌ Vlogger posts routes error:', error.message);
}

try {
  console.log('Loading vendor promotions routes...');
  app.use('/api/vendor-promotions', require('./routes/vendor-promotions'));
  console.log('✅ Vendor promotions routes loaded');
} catch (error) {
  console.error('❌ Vendor promotions routes error:', error.message);
}

try {
  console.log('Loading admin routes...');
  app.use('/api/admin', require('./routes/admin'));
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.error('❌ Admin routes error:', error.message);
}

// Skip other routes for now to identify the problematic one
console.log('Basic routes loaded successfully!');

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
app.listen(PORT, () => {
  console.log(`🚀 Bhookad Backend server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
});

// Export for testing
module.exports = app;
