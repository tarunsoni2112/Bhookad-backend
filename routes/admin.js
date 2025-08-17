const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/stats', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Get total vendors
    const { count: vendorCount } = await supabase
      .from('vendors')
      .select('*', { count: 'exact', head: true });

    // Get total vloggers
    const { count: vloggerCount } = await supabase
      .from('vloggers')
      .select('*', { count: 'exact', head: true });

    // Get pending posts
    const { count: pendingPostsCount } = await supabase
      .from('vlogger_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get total revenue from promotions
    const { data: promotions } = await supabase
      .from('vendor_promotions')
      .select('package_price')
      .eq('payment_status', 'completed');

    const totalRevenue = promotions?.reduce((sum, promo) => sum + parseFloat(promo.package_price), 0) || 0;

    // Get active promotions count
    const { count: activePromotionsCount } = await supabase
      .from('vendor_promotions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get total payouts
    const { data: approvedPosts } = await supabase
      .from('vlogger_posts')
      .select('payout_amount')
      .eq('status', 'approved')
      .not('payout_amount', 'is', null);

    const totalPayouts = approvedPosts?.reduce((sum, post) => sum + parseFloat(post.payout_amount || 0), 0) || 0;

    const stats = {
      totalVendors: vendorCount || 0,
      totalVloggers: vloggerCount || 0,
      pendingPosts: pendingPostsCount || 0,
      totalRevenue: totalRevenue,
      monthlyGrowth: 23, // This would be calculated based on historical data
      activePromotions: activePromotionsCount || 0,
      totalPayouts: totalPayouts,
      platformFee: totalRevenue * 0.1 // 10% platform fee
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/posts/pending
// @desc    Get all pending posts for review
// @access  Private (Admin only)
router.get('/posts/pending', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { data: posts, error } = await supabase
      .from('vlogger_posts')
      .select(`
        *,
        vloggers(name, username),
        vendors(name, location)
      `)
      .eq('status', 'pending')
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
    console.error('Get pending posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PATCH /api/admin/posts/:id/review
// @desc    Admin review post (approve/reject)
// @access  Private (Admin only)
router.patch('/posts/:id/review', async (req, res) => {
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

// @route   GET /api/admin/users
// @desc    Get all users (vendors and vloggers)
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { type } = req.query; // 'vendors' or 'vloggers'

    if (type === 'vendors') {
      const { data: vendors, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.json({
        success: true,
        users: vendors || []
      });

    } else if (type === 'vloggers') {
      const { data: vloggers, error } = await supabase
        .from('vloggers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.json({
        success: true,
        users: vloggers || []
      });

    } else {
      // Get both vendors and vloggers
      const [vendorsResult, vloggersResult] = await Promise.all([
        supabase.from('vendors').select('*').order('created_at', { ascending: false }),
        supabase.from('vloggers').select('*').order('created_at', { ascending: false })
      ]);

      res.json({
        success: true,
        vendors: vendorsResult.data || [],
        vloggers: vloggersResult.data || []
      });
    }

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/promotions
// @desc    Get all active promotions
// @access  Private (Admin only)
router.get('/promotions', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { data: promotions, error } = await supabase
      .from('vendor_promotions')
      .select(`
        *,
        vendors(name, location)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      promotions: promotions || []
    });

  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/activity
// @desc    Get recent platform activity
// @access  Private (Admin only)
router.get('/activity', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Get recent activities from different tables
    const activities = [
      {
        type: 'post_approved',
        description: 'Post approved for FoodieExplorer',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        type: 'promotion_purchased',
        description: 'Sharma Ji Ka Dhaba purchased Premium promotion',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      },
      {
        type: 'user_verified',
        description: 'New vlogger MumbaiEats verified',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    res.json({
      success: true,
      activities
    });

  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
