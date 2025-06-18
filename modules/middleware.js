// modules/middleware.js - Express-Middleware-Konfiguration

const express = require('express');
const path = require('path');

function configure(app) {
  console.log('🔧 Konfiguriere Express-Middleware...');
  
  // Body-Parser Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Statische Dateien
  app.use(express.static('public'));
  
  // Request-Logging
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    
    if (req.method === 'POST' && Object.keys(req.body || {}).length > 0) {
      console.log('📦 Request body keys:', Object.keys(req.body));
    }
    
    next();
  });
  
  // CORS-Headers (falls nötig)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });
  
  console.log('✅ Middleware konfiguriert');
}

function errorHandling(app) {
  console.log('🔧 Konfiguriere Error-Handling...');
  
  // 404-Handler
  app.use((req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ 
      error: 'Route not found',
      path: req.path,
      method: req.method,
      availableRoutes: [
        'GET /',
        'GET /games',
        'GET /games/all', 
        'GET /stats',
        'GET /crawl-cup',
        'POST /clear-db',
        'GET /health'
      ]
    });
  });

  // Global Error-Handler
  app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    
    // Stack-Trace nur in Entwicklung zeigen
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message,
      ...(isDevelopment && { stack: err.stack })
    });
  });
  
  console.log('✅ Error-Handling konfiguriert');
}

module.exports = {
  configure,
  errorHandling
};