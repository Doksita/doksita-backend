const pool = require("../config/db");
const path = require("path");
const fs = require("fs");

const uploadsDir = path.join(__dirname, "..", "uploads");

const mockFilePath = path.join(__dirname, "..", "mock_workspaces.json");

function getMockData() {
  try {
    if (fs.existsSync(mockFilePath)) {
      return JSON.parse(fs.readFileSync(mockFilePath, "utf8"));
    }
  } catch (err) {
    console.error("Gagal membaca mock data:", err);
  }
  return [];
}

function saveMockData(data) {
  try {
    fs.writeFileSync(mockFilePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Gagal menulis mock data:", err);
  }
}

function toUrlPath(filePath) {
  if (!filePath) return null;
  return "/uploads/" + path.basename(filePath);
}

function deleteLocalFile(urlPath) {
  if (!urlPath) return;
  const filename = path.basename(urlPath);
  const fullPath = path.join(uploadsDir, filename);
  fs.unlink(fullPath, () => {});
}

// CREATE WORKSPACE
exports.create = async (req, res) => {
  const {
    judul,
    Nama_Pemohon,
    Nomor_Alas_Hak,
    Lokasi,
    no_berkas,
    catatan,
    keterangan_atas,
    ukuran_kertas,
    orientasi,
    photo_data,
  } = req.body;
  const userId = req.user.id;

  if (!judul) {
    return res.status(400).json({ message: "Judul harus diisi" });
  }

  const conn = await pool.getConnection().catch(() => null);

  if (!conn) {
    // MOCK CREATE
    const mockData = getMockData();
    const newId = mockData.length > 0 ? Math.max(...mockData.map((w) => w.id || 0)) + 1 : 1;
    const photoMeta = safeParseJson(photo_data);
    const files = req.files || [];
    let fileIndex = 0;

    const newPhotos = [];
    for (let i = 0; i < 4; i++) {
      const meta = photoMeta[i] || {};
      let fotoPath = null;
      if (meta.hasNewFile && files[fileIndex]) {
        fotoPath = toUrlPath(files[fileIndex].path);
        fileIndex++;
      }
      newPhotos.push({
        id: Date.now() + i,
        workspace_id: newId,
        foto_path: fotoPath,
        keterangan: meta.keterangan || "",
        arah: meta.arah || "Kiri",
        pos_y: meta.pos_y ?? 50,
        urutan: i,
      });
    }

    const newWorkspace = {
      id: newId,
      user_id: userId,
      judul,
      Nama_Pemohon,
      Nomor_Alas_Hak,
      Lokasi,
      no_berkas,
      catatan,
      ukuran_kertas,
      orientasi,
      created_at: new Date(),
      updated_at: new Date(),
      photos: newPhotos,
    };

    mockData.push(newWorkspace);
    saveMockData(mockData);

    return res.status(201).json({
      message: "Workspace berhasil disimpan (Mock Mode)",
      id: newId,
    });
  }

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      "INSERT INTO workspaces (user_id, judul, Nama_Pemohon, Nomor_Alas_Hak, Lokasi, no_berkas, catatan, keterangan_atas, ukuran_kertas, orientasi) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        userId,
        judul,
        Nama_Pemohon || null, 
        Nomor_Alas_Hak || null,
        Lokasi || null,
        no_berkas || null,
        catatan || null,
        keterangan_atas || null,
        ukuran_kertas || "A4",
        orientasi || "Portrait",
      ],
    );

    const workspaceId = result.insertId;
    const photoMeta = safeParseJson(photo_data);
    const files = req.files || [];
    let fileIndex = 0;

    for (let i = 0; i < 4; i++) {
      const meta = photoMeta[i] || {};
      let fotoPath = null;

      if (meta.hasNewFile && files[fileIndex]) {
        fotoPath = toUrlPath(files[fileIndex].path);
        fileIndex++;
      }

      await conn.query(
        "INSERT INTO workspace_photos (workspace_id, foto_path, keterangan, arah, pos_y, urutan) VALUES (?, ?, ?, ?, ?, ?)",
        [
          workspaceId,
          fotoPath,
          meta.keterangan || "",
          meta.arah || "Kiri",
          meta.pos_y ?? 50,
          i,
        ],
      );
    }

    await conn.commit();
    res
      .status(201)
      .json({ message: "Workspace berhasil disimpan", id: workspaceId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    conn.release();
  }
};

// GET ALL WORKSPACES (user's own)
exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, judul, Nama_Pemohon, Nomor_Alas_Hak, Lokasi, no_berkas, catatan, keterangan_atas, ukuran_kertas, orientasi, created_at, updated_at FROM workspaces WHERE user_id = ? ORDER BY updated_at DESC",
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    if (req.user.username === "admin") {
      const mockData = getMockData().filter((w) => w.user_id === req.user.id);
      if (mockData.length === 0) {
        return res.json([
          {
            id: 1,
            judul: "Sampel Dokumentasi Tanah 1",
            Nama_Pemohon: "Wahyu",
            Nomor_Alas_Hak: "01/dt/III/2026",
            Lokasi: "Jalan Pekalongan",
            no_berkas: "123/2026",
            catatan: "Ini adalah data dummy untuk mode pengembangan.",
            ukuran_kertas: "A4",
            orientasi: "Portrait",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);
      }
      return res.json(mockData);
    }
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// GET SINGLE WORKSPACE with photos
exports.getById = async (req, res) => {
  try {
    const [workspaces] = await pool.query(
      "SELECT * FROM workspaces WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id],
    );

    if (workspaces.length === 0) {
      if (req.user.username === "admin") {
        const mock = getMockData().find(
          (w) => w.id === Number(req.params.id) && w.user_id === req.user.id,
        );
        if (mock) return res.json(mock);

        if (req.params.id === "1") {
          return res.json({
            id: 1,
            judul: "Sampel Dokumentasi Tanah 1",
            Nama_Pemohon: "Wahyu",
            Nomor_Alas_Hak: "01/dt/III/2026",
            Lokasi: "Jalan Pekalongan",
            no_berkas: "123/2026",
            catatan: "Ini adalah data dummy untuk mode pengembangan.",
            ukuran_kertas: "A4",
            orientasi: "Portrait",
            photos: [],
          });
        }
      }
      return res.status(404).json({ message: "Workspace tidak ditemukan" });
    }

    const [photos] = await pool.query(
      "SELECT id, foto_path, keterangan, arah, pos_y, urutan FROM workspace_photos WHERE workspace_id = ? ORDER BY urutan",
      [req.params.id],
    );

    res.json({ ...workspaces[0], photos });
  } catch (err) {
    if (req.user.username === "admin") {
      const mock = getMockData().find(
        (w) => w.id === Number(req.params.id) && w.user_id === req.user.id,
      );
      if (mock) return res.json(mock);

      if (req.params.id === "1") {
        return res.json({
          id: 1,
          judul: "Sampel Dokumentasi Tanah 1",
           Nama_Pemohon: "Wahyu",
          Nomor_Alas_Hak: "01/dt/III/2026",
          Lokasi: "Jalan Pekalongan",
          no_berkas: "123/2026",
          catatan: "Ini adalah data dummy untuk mode pengembangan.",
          ukuran_kertas: "A4",
          orientasi: "Portrait",
          photos: [],
        });
      }
    }
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// UPDATE WORKSPACE
exports.update = async (req, res) => {
  const {
    judul,
    Nama_Pemohon,
    Nomor_Alas_Hak,
    Lokasi,
    no_berkas,
    catatan,
    keterangan_atas,
    ukuran_kertas,
    orientasi,
    photo_data,
  } = req.body;
  const userId = req.user.id;
  const workspaceId = req.params.id;

  if (!judul) {
    return res.status(400).json({ message: "Judul harus diisi" });
  }

  const conn = await pool.getConnection().catch(() => null);

  if (!conn) {
    // MOCK UPDATE
    let mockData = getMockData();
    const index = mockData.findIndex(
      (w) => w.id === Number(workspaceId) && w.user_id === userId,
    );

    if (index === -1) {
      return res.status(404).json({ message: "Workspace tidak ditemukan" });
    }

    const photoMeta = safeParseJson(photo_data);
    const files = req.files || [];
    let fileIndex = 0;

    const currentPhotos = mockData[index].photos || [];
    const newPhotos = [];

    for (let i = 0; i < 4; i++) {
      const meta = photoMeta[i] || {};
      let fotoPath = null;

      if (meta.hasNewFile && files[fileIndex]) {
        fotoPath = toUrlPath(files[fileIndex].path);
        fileIndex++;
      } else if (meta.existingPath) {
        fotoPath = meta.existingPath;
      }

      newPhotos.push({
        id: currentPhotos[i]?.id || Date.now() + i,
        workspace_id: workspaceId,
        foto_path: fotoPath,
        keterangan: meta.keterangan || "",
        arah: meta.arah || "Kiri",
        pos_y: meta.pos_y ?? 50,
        urutan: i,
      });
    }

    mockData[index] = {
      ...mockData[index],
      judul,
      Nama_Pemohon,
      Nomor_Alas_Hak,
      Lokasi,
      no_berkas,
      catatan,
      ukuran_kertas,
      orientasi,
      updated_at: new Date(),
      photos: newPhotos,
    };

    saveMockData(mockData);
    return res.json({ message: "Workspace berhasil diupdate (Mock Mode)" });
  }

  try {
    const [existing] = await conn.query(
      "SELECT id FROM workspaces WHERE id = ? AND user_id = ?",
      [workspaceId, userId],
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Workspace tidak ditemukan" });
    }

    await conn.beginTransaction();

    await conn.query(
      "UPDATE workspaces SET judul = ?, no_berkas = ?, catatan = ?, keterangan_atas = ?, ukuran_kertas = ?, orientasi = ? WHERE id = ? AND user_id = ?",
      [
        judul,
        Nama_Pemohon, 
        Nomor_Alas_Hak,
        Lokasi,
        no_berkas || null,
        catatan || null,
        keterangan_atas || null,
        ukuran_kertas || "A4",
        orientasi || "Portrait",
        workspaceId,
        userId,
      ],
    );

    const [oldPhotos] = await conn.query(
      "SELECT foto_path FROM workspace_photos WHERE workspace_id = ?",
      [workspaceId],
    );

    await conn.query("DELETE FROM workspace_photos WHERE workspace_id = ?", [
      workspaceId,
    ]);

    const photoMeta = safeParseJson(photo_data);
    const files = req.files || [];
    let fileIndex = 0;
    const newPaths = new Set();

    for (let i = 0; i < 4; i++) {
      const meta = photoMeta[i] || {};
      let fotoPath = null;

      if (meta.hasNewFile && files[fileIndex]) {
        fotoPath = toUrlPath(files[fileIndex].path);
        fileIndex++;
      } else if (meta.existingPath) {
        fotoPath = meta.existingPath;
      }

      if (fotoPath) newPaths.add(fotoPath);

      await conn.query(
        "INSERT INTO workspace_photos (workspace_id, foto_path, keterangan, arah, pos_y, urutan) VALUES (?, ?, ?, ?, ?, ?)",
        [
          workspaceId,
          fotoPath,
          meta.keterangan || "",
          meta.arah || "Kiri",
          meta.pos_y ?? 50,
          i,
        ],
      );
    }

    await conn.commit();

    // Clean up removed photos from local storage
    for (const photo of oldPhotos) {
      if (photo.foto_path && !newPaths.has(photo.foto_path)) {
        deleteLocalFile(photo.foto_path);
      }
    }

    res.json({ message: "Workspace berhasil diupdate" });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  } finally {
    conn.release();
  }
};

// DELETE WORKSPACE
exports.remove = async (req, res) => {
  const conn = await pool.getConnection().catch(() => null);

  if (!conn) {
    // MOCK DELETE
    let mockData = getMockData();
    const index = mockData.findIndex(
      (w) => w.id === Number(req.params.id) && w.user_id === req.user.id,
    );

    if (index === -1) {
      return res.status(404).json({ message: "Workspace tidak ditemukan" });
    }

    const photos = mockData[index].photos || [];
    for (const photo of photos) {
      deleteLocalFile(photo.foto_path);
    }

    mockData.splice(index, 1);
    saveMockData(mockData);
    return res.json({ message: "Workspace berhasil dihapus (Mock Mode)" });
  }

  try {
    const [photos] = await pool.query(
      "SELECT foto_path FROM workspace_photos WHERE workspace_id = ? AND foto_path IS NOT NULL",
      [req.params.id],
    );

    for (const photo of photos) {
      deleteLocalFile(photo.foto_path);
    }

    await pool.query("DELETE FROM workspaces WHERE id = ? AND user_id = ?", [
      req.params.id,
      req.user.id,
    ]);

    res.json({ message: "Workspace berhasil dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// Helper
function safeParseJson(str) {
  try {
    return JSON.parse(str || "[]");
  } catch {
    return [];
  }
}
