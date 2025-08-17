const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { supabase } = require('../config/supabase');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/mov'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// @route   POST /api/media/upload
// @desc    Upload media files
// @access  Private
router.post('/upload', upload.array('files', 5), async (req, res) => {
  try {
    const { vendor_id, vlogger_id, type } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedFiles = [];

    for (const file of files) {
      let processedBuffer = file.buffer;
      let fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Process images
      if (file.mimetype.startsWith('image/')) {
        processedBuffer = await sharp(file.buffer)
          .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        fileName += '.jpg';
      } else {
        fileName += file.originalname.substring(file.originalname.lastIndexOf('.'));
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, processedBuffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // Save media record to database
      const { data: mediaRecord, error: dbError } = await supabase
        .from('media')
        .insert([
          {
            type: file.mimetype.startsWith('image/') ? 'image' : 'video',
            url: publicUrl,
            vendor_id: vendor_id || null,
            vlogger_id: vlogger_id || null,
            file_name: fileName,
            file_size: file.size,
            mime_type: file.mimetype,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        continue;
      }

      uploadedFiles.push(mediaRecord);
    }

    res.status(201).json({
      success: true,
      message: `${uploadedFiles.length} files uploaded successfully`,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading media'
    });
  }
});

// @route   GET /api/media
// @desc    Get media files
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { vendor_id, vlogger_id, type, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false });

    if (vendor_id) {
      query = query.eq('vendor_id', vendor_id);
    }

    if (vlogger_id) {
      query = query.eq('vlogger_id', vlogger_id);
    }

    if (type) {
      query = query.eq('type', type);
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      count: data.length,
      media: data
    });

  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting media'
    });
  }
});

module.exports = router;
