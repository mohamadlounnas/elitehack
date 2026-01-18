import { Router } from "express";
import multer from "multer";
import path from "path";
import fsPromises from "fs/promises";
import { logger } from "../utils/logger.js";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * Upload file endpoint
 * POST /api/v1/tmp/upload
 * Returns: { url: string }
 */
router.post("/tmp/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const file = req.file;
    const timestamp = Date.now();
    const extension = path.extname(file.originalname) || ".bin";
    const filename = `upload_${timestamp}${extension}`;

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "tmp", "uploads");
    await fsPromises.mkdir(uploadsDir, { recursive: true });

    // Save file to disk
    const filePath = path.join(uploadsDir, filename);
    await fsPromises.writeFile(filePath, file.buffer);

    // Construct public URL
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3001";
    const publicUrl = `${apiBaseUrl}/tmp/uploads/${filename}`;

    logger.info("File uploaded successfully", {
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      publicUrl,
    });

    res.json({ url: publicUrl });
  } catch (error: any) {
    logger.error("Error uploading file", error);
    res.status(500).json({ error: error.message || "Failed to upload file" });
  }
});

export default router;


