const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// @route   GET /api/reviews
// @desc    Get reviews with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { vendor_id, user_id, rating_min, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('reviews')
      .select(`
        *,
        users(name),
        vendors(name)
      `)
      .order('created_at', { ascending: false });

    if (vendor_id) {
      query = query.eq('vendor_id', vendor_id);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (rating_min) {
      query = query.gte('rating', parseInt(rating_min));
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
      reviews: data
    });

  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting reviews'
    });
  }
});

// @route   POST /api/reviews
// @desc    Create new review
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { vendor_id, rating, comment, photos } = req.body;
    
    // TODO: Get user_id from JWT token
    const user_id = req.user?.id; // This will come from auth middleware

    if (!vendor_id || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID aur rating required hain'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating 1 se 5 ke beech honi chahiye'
      });
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert([
        {
          vendor_id,
          user_id,
          rating,
          comment,
          photos,
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
      message: 'Review successfully submitted',
      review: data
    });

  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating review'
    });
  }
});

module.exports = router;
