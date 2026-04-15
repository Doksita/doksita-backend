const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });

async function setup() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    console.log('Koneksi ke MySQL berhasil.');
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'doksita'}`);
    console.log(`Database ${process.env.DB_NAME || 'doksita'} siap.`);
    
    await connection.changeUser({ database: process.env.DB_NAME || 'doksita' });
    
    // Create tables (minimal for login)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await connection.query(`
      INSERT IGNORE INTO users (nama, username, email, password) 
      VALUES ('Admin Doksita', 'admin', 'admin@doksita.com', ?)
    `, [hashedPassword]);
    
    console.log('Akun default dibuat:');
    console.log('Username: admin');
    console.log('Password: admin123');
    
    await connection.end();
  } catch (err) {
    console.error('Gagal setup database:', err.message);
    process.exit(1);
  }
}

setup();
