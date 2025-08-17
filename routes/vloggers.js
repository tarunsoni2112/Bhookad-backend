const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// @route   GET /api/vloggers
// @desc    Get all vloggers
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { platform, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('vloggers')
      .select(`
        *,
        media:media(url, type, ai_tags)
      `)
      .eq('verified', true)
      .order('followers', { ascending: false });

    if (platform) {
      query = query.eq('platform', platform);
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
      vloggers: data
    });

  } catch (error) {
    console.error('Get vloggers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting vloggers'
    });
  }
});

// @route   POST /api/vloggers
// @desc    Create new vlogger
// @access  Private
router.post('/', async (req, res) => {
  try {
    const {
      name,
      platform,
      username,
      followers,
      content_type,
      bio,
      social_links,
      location
    } = req.body;

    if (!name || !platform || !username) {
      return res.status(400).json({
        success: false,
        message: 'Name, platform aur username required hain'
      });
    }

    const { data, error } = await supabase
      .from('vloggers')
      .insert([
        {
          name,
          platform,
          username,
          followers: followers || 0,
          content_type,
          bio,
          social_links,
          location,
          verified: false,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Vlogger successfully created',
      vlogger: data
    });

  } catch (error) {
    console.error('Create vlogger error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating vlogger'
    });
  }
});

module.exports = router;
