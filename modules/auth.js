// modules/auth.js - Sichere Authentifizierung für Backend

const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

// Rate Limiting für Login-Versuche
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5, // Max 5 Versuche pro IP
  message: {
    error: 'Zu viele Login-Versuche. Bitte warten Sie 15 Minuten.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware: Prüft ob User eingeloggt ist
function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  } else {
    return res.status(401).json({ 
      error: 'Authentication required',
      redirect: '/dev/login'
    });
  }
}

// Login-Validierung
async function validateLogin(username, password) {
  try {
    const usernameHash = process.env.ADMIN_USERNAME_HASH;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    
    if (!usernameHash || !passwordHash) {
      console.error('❌ ADMIN_USERNAME_HASH oder ADMIN_PASSWORD_HASH nicht in .env gesetzt');
      return false;
    }
    
    // Beide Hashes parallel prüfen (verhindert Timing-Attacken)
    const [usernameValid, passwordValid] = await Promise.all([
      bcrypt.compare(username, usernameHash),
      bcrypt.compare(password, passwordHash)
    ]);
    
    return usernameValid && passwordValid;
    
  } catch (error) {
    console.error('❌ Login validation error:', error);
    return false;
  }
}

// Auth-Routen registrieren
function register(app) {
  console.log('🔐 Registriere Auth-Routen...');
  
  // GET /dev/login - Login-Seite anzeigen
  app.get('/dev/login', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
      return res.redirect('/dev/');
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Backend Login</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            background: #1a1a1a; 
            color: #fff; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
          }
          .login-form { 
            background: #2a2a2a; 
            padding: 2rem; 
            border-radius: 8px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
          }
          .form-group { margin-bottom: 1rem; }
          label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
          input { 
            width: 100%; 
            padding: 0.75rem; 
            border: 1px solid #444; 
            border-radius: 4px; 
            background: #333; 
            color: #fff; 
            box-sizing: border-box;
          }
          button { 
            width: 100%; 
            padding: 0.75rem; 
            background: #007bff; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 1rem;
          }
          button:hover { background: #0056b3; }
          .error { color: #ff6b6b; margin-top: 1rem; padding: 0.5rem; background: #2a1a1a; border-radius: 4px; }
          h2 { text-align: center; margin-bottom: 2rem; color: #007bff; }
        </style>
      </head>
      <body>
        <div class="login-form">
          <h2>🔐 Backend Login</h2>
          <form id="loginForm">
            <div class="form-group">
              <label for="username">Username:</label>
              <input type="text" id="username" name="username" required autocomplete="username">
            </div>
            <div class="form-group">
              <label for="password">Password:</label>
              <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>
            <button type="submit">Login</button>
          </form>
          <div id="error" class="error" style="display: none;"></div>
        </div>
        
        <script>
          document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            
            try {
              const response = await fetch('/dev/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
              });
              
              const data = await response.json();
              
              if (data.success) {
                window.location.href = '/dev/';
              } else {
                errorDiv.textContent = data.error || 'Login fehlgeschlagen';
                errorDiv.style.display = 'block';
              }
            } catch (error) {
              errorDiv.textContent = 'Verbindungsfehler';
              errorDiv.style.display = 'block';
            }
          });
        </script>
      </body>
      </html>
    `);
  });
  
  // POST /dev/login - Login verarbeiten
  app.post('/dev/login', loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Username und Password erforderlich' 
        });
      }
      
      // Künstliche Verzögerung gegen Timing-Attacken
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      const isValid = await validateLogin(username, password);
      
      if (isValid) {
        req.session.isAuthenticated = true;
        req.session.loginTime = new Date().toISOString();
        
        console.log(`✅ Successful admin login from ${req.ip}`);
        
        res.json({ 
          success: true, 
          message: 'Login erfolgreich',
          redirect: '/dev/' 
        });
      } else {
        console.warn(`❌ Failed admin login attempt from ${req.ip}`);
        
        res.status(401).json({ 
          success: false, 
          error: 'Ungültige Anmeldedaten' 
        });
      }
      
    } catch (error) {
      console.error('❌ Login error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Server-Fehler' 
      });
    }
  });
  
  // POST /dev/logout - Logout
  app.post('/dev/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('❌ Logout error:', err);
        return res.status(500).json({ error: 'Logout fehlgeschlagen' });
      }
      
      console.log(`🚪 Admin logout from ${req.ip}`);
      res.json({ success: true, message: 'Logout erfolgreich' });
    });
  });
  
  // GET /dev/status - Auth-Status prüfen
  app.get('/dev/status', (req, res) => {
    res.json({
      authenticated: !!(req.session && req.session.isAuthenticated),
      loginTime: req.session ? req.session.loginTime : null
    });
  });
  
  console.log('✅ Auth-Routen registriert');
}

module.exports = {
  requireAuth,
  loginLimiter,
  register
};