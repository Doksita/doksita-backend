const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const { sendOtpEmail } = require("../services/mail");

// REGISTER
exports.register = async (req, res) => {
  const { nama, username, email, password } = req.body;

  if (!nama || !username || !email || !password) {
    return res.status(400).json({ message: "Semua field harus diisi" });
  }

  try {
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email],
    );

    if (existing.length > 0) {
      return res
        .status(409)
        .json({ message: "Username atau email sudah terdaftar" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (nama, username, email, password) VALUES (?, ?, ?, ?)",
      [nama, username, email, hashedPassword],
    );

    res.status(201).json({ message: "Registrasi berhasil" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// LOGIN
exports.login = async (req, res) => {
  const { username, password } = req.body;

  // BYPASS FOR DEVELOPMENT
  if (username === "admin" && password === "admin") {
    const token = jwt.sign(
      { id: 1, username: "admin" },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "1d" },
    );
    return res.json({
      message: "Login berhasil (Dev Mode)",
      token,
      user: {
        id: 1,
        nama: "Admin Developer",
        username: "admin",
        email: "admin@doksita.com",
      },
    });
  }

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username/email dan password harus diisi" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE username = ? OR email = ?",
      [username, username],
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Username/email atau password salah" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res
        .status(401)
        .json({ message: "Username/email atau password salah" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      message: "Login berhasil",
      token,
      user: {
        id: user.id,
        nama: user.nama,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Semua field harus diisi" });
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Password baru minimal 6 karakter" });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [
      req.user.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) {
      return res
        .status(401)
        .json({ message: "Password saat ini tidak sesuai" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      req.user.id,
    ]);

    res.json({ message: "Password berhasil diubah" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// FORGOT PASSWORD - Send OTP
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email harus diisi" });
  }

  try {
    const [users] = await pool.query(
      "SELECT id, nama FROM users WHERE email = ?",
      [email],
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "Email tidak terdaftar" });
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      "UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0",
      [email],
    );
    await pool.query(
      "INSERT INTO password_resets (email, otp_code, expires_at) VALUES (?, ?, ?)",
      [email, otpCode, expiresAt],
    );

    await sendOtpEmail(email, users[0].nama, otpCode);

    res.json({ message: "Kode OTP telah dikirim ke email Anda" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Gagal mengirim OTP. Periksa konfigurasi email." });
  }
};

// VERIFY OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email dan kode OTP harus diisi" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM password_resets WHERE email = ? AND otp_code = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [email, otp],
    );

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ message: "Kode OTP tidak valid atau sudah kedaluwarsa" });
    }

    res.json({ message: "Kode OTP valid", valid: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "Semua field harus diisi" });
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Password baru minimal 6 karakter" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM password_resets WHERE email = ? AND otp_code = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [email, otp],
    );

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ message: "Kode OTP tidak valid atau sudah kedaluwarsa" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = ? WHERE email = ?", [
      hashedPassword,
      email,
    ]);
    await pool.query("UPDATE password_resets SET used = 1 WHERE id = ?", [
      rows[0].id,
    ]);

    res.json({ message: "Password berhasil direset" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};
