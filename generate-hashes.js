const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function generateHashes() {
  console.log('🔐 Generiere sichere Login-Hashes...\n');
  
  // HIER deine gewünschten Login-Daten eingeben:
  const username = 'admin';
  const password = 'IHR_SICHERES_PASSWORT_HIER';  // ÄNDERN SIE DIES VOR DEM AUSFÜHREN!  
  
  try {
    console.log('⏳ Generiere bcrypt-Hashes...');
    
    const [usernameHash, passwordHash] = await Promise.all([
      bcrypt.hash(username, 12),
      bcrypt.hash(password, 12)
    ]);
    
    const sessionSecret = crypto.randomBytes(64).toString('hex');
    
    console.log('✅ Hashes erfolgreich generiert!\n');
    console.log('📋 Kopiere diese Zeilen in deine .env Datei:');
    console.log('=' .repeat(60));
    console.log(`ADMIN_USERNAME_HASH=${usernameHash}`);
    console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
    console.log(`SESSION_SECRET=${sessionSecret}`);
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  }
}

generateHashes();
