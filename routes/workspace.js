const express = require("express");
const authMiddleware = require("../middleware/auth");
const upload = require("../middleware/upload");
const workspace = require("../controllers/workspaceController");

const router = express.Router();

router.post("/", authMiddleware, upload.array("photos", 4), workspace.create);
router.get("/", authMiddleware, workspace.getAll);
router.get("/:id", authMiddleware, workspace.getById);
router.put("/:id", authMiddleware, upload.array("photos", 4), workspace.update);
router.delete("/:id", authMiddleware, workspace.remove);

module.exports = router;
