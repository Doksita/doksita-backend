const pool = require("../config/db");

async function syncDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        judul VARCHAR(255) NOT NULL,
        Nama_Pemohon VARCHAR(50) NOT NULL,
        Nomor_Alas_Hak VARCHAR(50) NOT NULL,
        Lokasi VARCHAR(50) NOT NULL,
        no_berkas VARCHAR(50),
        catatan TEXT,
        keterangan_atas VARCHAR(255),
        ukuran_kertas VARCHAR(10) DEFAULT 'A4',
        orientasi VARCHAR(10) DEFAULT 'Portrait',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspace_photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workspace_id INT NOT NULL,
        foto_path VARCHAR(255),
        keterangan VARCHAR(255),
        arah VARCHAR(50),
        pos_y INT DEFAULT 50,
        urutan INT DEFAULT 0,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        otp_code VARCHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Database sync: semua tabel siap");
  } catch (err) {
    console.error("Database sync gagal:", err.message);
    throw err;
  }
}

module.exports = syncDatabase;
