const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// @route   GET /api/vlogger-posts
// @desc    Get vlogger's posts
// @access  Private (Vlogger only)
router.get('/', async (req, res) => {
  try {
    const vloggerId = req.user?.id; // Assuming auth middleware sets user

    if (!vloggerId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { data: posts, error } = await supabase
      .from('vlogger_posts')
      .select(`
        *,
        vendors(name, cuisine_type),
        users(full_name)
      `)
      .eq('vlogger_id', vloggerId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      posts: posts || []
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/vlogger-posts
// @desc    Submit new vlogger post
// @access  Private (Vlogger only)
router.post('/', upload.single('screenshot'), async (req, res) => {
  try {
    const vloggerId = req.user?.id;
    const {
      vendor_id,
      post_title,
      post_description,
      post_url,
      platform
    } = req.body;

    if (!vloggerId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Validate required fields
    if (!vendor_id || !post_title || !post_url || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Vendor, title, URL, and platform are required'
      });
    }

    let screenshotUrl = null;

    // Upload screenshot if provided
    if (req.file) {
      const fileName = `vlogger-posts/${vloggerId}/${Date.now()}-${req.file.originalname}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Screenshot upload error:', uploadError);
        return res.status(400).json({
          success: false,
          message: 'Failed to upload screenshot'
        });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      screenshotUrl = publicUrl;
    }

    // Insert post record
    const { data: post, error: insertError } = await supabase
      .from('vlogger_posts')
      .insert([
        {
          vlogger_id: vloggerId,
          vendor_id,
          post_title,
          post_description: post_description || null,
          post_url,
          screenshot_url: screenshotUrl,
          platform,
          status: 'pending',
          submitted_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({
        success: false,
        message: insertError.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Post submitted successfully! Waiting for admin approval.',
      post
    });

  } catch (error) {
    console.error('Post submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/vlogger-posts/admin
// @desc    Get all posts for admin review
// @access  Private (Admin only)
router.get('/admin', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { status = 'pending' } = req.query;

    const { data: posts, error } = await supabase
      .from('vlogger_posts')
      .select(`
        *,
        vloggers(name, platform, username),
        vendors(name, cuisine_type, location),
        users(full_name)
      `)
      .eq('status', status)
      .order('submitted_at', { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      posts: posts || []
    });

  } catch (error) {
    console.error('Admin get posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PATCH /api/vlogger-posts/:id/review
// @desc    Admin review post (approve/reject)
// @access  Private (Admin only)
router.patch('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, payout_amount } = req.body;
    const adminId = req.user?.id;

    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved or rejected'
      });
    }

    const updateData = {
      status,
      admin_notes: admin_notes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId
    };

    // Add payout amount if approved
    if (status === 'approved' && payout_amount) {
      updateData.payout_amount = parseFloat(payout_amount);
    }

    const { data: post, error } = await supabase
      .from('vlogger_posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: `Post ${status} successfully`,
      post
    });

  } catch (error) {
    console.error('Post review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
