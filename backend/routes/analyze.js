const express = require('express');
const multer = require('multer');
const { validateSingleObject } = require('../services/llmService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

router.post('/analyze', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片' });
    }
    if (!ALLOWED_MIMES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: '仅支持 JPG/PNG/GIF/WebP 图片格式', received: req.file.mimetype });
    }
    const imageBase64 = req.file.buffer.toString('base64');
    const result = await validateSingleObject(imageBase64);
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.analysis);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
