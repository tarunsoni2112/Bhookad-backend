const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// @route   GET /api/vendor-promotions
// @desc    Get vendor's active promotions
// @access  Private (Vendor only)
router.get('/', async (req, res) => {
  try {
    const vendorId = req.user?.id; // Assuming auth middleware sets user

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { data: promotions, error } = await supabase
      .from('vendor_promotions')
      .select('*')
      .eq('vendor_id', vendorId)
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

// @route   POST /api/vendor-promotions/purchase
// @desc    Purchase promotion package
// @access  Private (Vendor only)
router.post('/purchase', async (req, res) => {
  try {
    const vendorId = req.user?.id;
    const {
      package_id,
      package_name,
      package_price,
      package_duration,
      payment_method = 'test'
    } = req.body;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Validate required fields
    if (!package_id || !package_name || !package_price || !package_duration) {
      return res.status(400).json({
        success: false,
        message: 'Package details are required'
      });
    }

    // Check if vendor already has an active promotion
    const { data: existingPromotion } = await supabase
      .from('vendor_promotions')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .single();

    if (existingPromotion) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active promotion. Please wait for it to expire.'
      });
    }

    // Calculate end date based on duration
    const startDate = new Date();
    const endDate = new Date();
    
    if (package_duration === '1 Month') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (package_duration === '3 Months') {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (package_duration === '6 Months') {
      endDate.setMonth(endDate.getMonth() + 6);
    }

    // For testing - simulate payment processing
    const paymentId = 'pay_' + Math.random().toString(36).substr(2, 9);
    
    // Insert promotion record
    const { data: promotion, error: insertError } = await supabase
      .from('vendor_promotions')
      .insert([
        {
          vendor_id: vendorId,
          package_id,
          package_name,
          package_price: parseFloat(package_price),
          package_duration,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          payment_id: paymentId,
          payment_method,
          payment_status: 'completed',
          created_at: new Date().toISOString()
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

    // Update vendor profile to mark as featured
    const { error: updateError } = await supabase
      .from('vendors')
      .update({
        is_featured: true,
        promotion_tier: package_id,
        featured_until: endDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', vendorId);

    if (updateError) {
      console.error('Error updating vendor profile:', updateError);
      // Don't fail the request, just log the error
    }

    res.status(201).json({
      success: true,
      message: 'Promotion purchased successfully!',
      promotion,
      payment_id: paymentId
    });

  } catch (error) {
    console.error('Promotion purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/vendor-promotions/packages
// @desc    Get available promotion packages
// @access  Public
router.get('/packages', async (req, res) => {
  try {
    const packages = [
      {
        id: 'basic',
        name: 'Basic Boost',
        price: 2999,
        duration: '1 Month',
        features: [
          'Featured in search results',
          'Homepage banner (2 days)',
          'Social media mentions',
          'Basic analytics'
        ],
        color: 'blue',
        popular: false
      },
      {
        id: 'premium',
        name: 'Premium Push',
        price: 7999,
        duration: '3 Months',
        features: [
          'Top search placement',
          'Homepage banner (1 week)',
          'Vlogger collaboration priority',
          'Advanced analytics',
          'Customer review highlights'
        ],
        color: 'orange',
        popular: true
      },
      {
        id: 'ultimate',
        name: 'Ultimate Exposure',
        price: 19999,
        duration: '6 Months',
        features: [
          'Premium placement everywhere',
          'Dedicated promotion page',
          'Guaranteed vlogger partnerships',
          'Complete analytics suite',
          'Personal account manager'
        ],
        color: 'purple',
        popular: false
      }
    ];

    res.json({
      success: true,
      packages
    });

  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PATCH /api/vendor-promotions/:id/cancel
// @desc    Cancel active promotion
// @access  Private (Vendor only)
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user?.id;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { data: promotion, error } = await supabase
      .from('vendor_promotions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('vendor_id', vendorId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Update vendor profile
    const { error: updateError } = await supabase
      .from('vendors')
      .update({
        is_featured: false,
        promotion_tier: null,
        featured_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', vendorId);

    if (updateError) {
      console.error('Error updating vendor profile:', updateError);
    }

    res.json({
      success: true,
      message: 'Promotion cancelled successfully',
      promotion
    });

  } catch (error) {
    console.error('Cancel promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
