const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// @route   GET /api/vendors
// @desc    Get all vendors with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      city, 
      cuisine_type, 
      rating_min, 
      limit = 20, 
      offset = 0,
      search 
    } = req.query;

    let query = supabase
      .from('vendors')
      .select(`
        *,
        reviews:reviews(rating),
        media:media(url, type)
      `)
      .eq('verified', true)
      .order('rating', { ascending: false });

    // Apply filters
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    if (cuisine_type) {
      query = query.eq('cuisine_type', cuisine_type);
    }

    if (rating_min) {
      query = query.gte('rating', parseFloat(rating_min));
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Calculate average rating for each vendor
    const vendorsWithRating = data.map(vendor => ({
      ...vendor,
      average_rating: vendor.reviews.length > 0 
        ? vendor.reviews.reduce((sum, review) => sum + review.rating, 0) / vendor.reviews.length
        : 0,
      total_reviews: vendor.reviews.length,
      photos: vendor.media.filter(m => m.type === 'image'),
      videos: vendor.media.filter(m => m.type === 'video')
    }));

    res.json({
      success: true,
      count: vendorsWithRating.length,
      vendors: vendorsWithRating
    });

  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting vendors'
    });
  }
});

// @route   GET /api/vendors/:id
// @desc    Get single vendor by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vendors')
      .select(`
        *,
        reviews:reviews(*, users(name)),
        media:media(url, type, ai_tags)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Calculate ratings
    const averageRating = data.reviews.length > 0 
      ? data.reviews.reduce((sum, review) => sum + review.rating, 0) / data.reviews.length
      : 0;

    const vendorWithDetails = {
      ...data,
      average_rating: averageRating,
      total_reviews: data.reviews.length,
      photos: data.media.filter(m => m.type === 'image'),
      videos: data.media.filter(m => m.type === 'video')
    };

    res.json({
      success: true,
      vendor: vendorWithDetails
    });

  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting vendor'
    });
  }
});

// @route   POST /api/vendors
// @desc    Create new vendor (Admin only)
// @access  Private
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      cuisine_type,
      contact_phone,
      contact_email,
      opening_hours,
      price_range,
      specialties
    } = req.body;

    // Validate required fields
    if (!name || !address || !city || !cuisine_type) {
      return res.status(400).json({
        success: false,
        message: 'Name, address, city aur cuisine type required hain'
      });
    }

    const { data, error } = await supabase
      .from('vendors')
      .insert([
        {
          name,
          description,
          address,
          city: city.toLowerCase(),
          state,
          pincode,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          cuisine_type,
          contact_phone,
          contact_email,
          opening_hours,
          price_range,
          specialties,
          rating: 0,
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
      message: 'Vendor successfully created',
      vendor: data
    });

  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating vendor'
    });
  }
});

// @route   PUT /api/vendors/:id
// @desc    Update vendor
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.rating; // Rating is calculated from reviews

    const { data, error } = await supabase
      .from('vendors')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
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
      message: 'Vendor updated successfully',
      vendor: data
    });

  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating vendor'
    });
  }
});

// @route   DELETE /api/vendors/:id
// @desc    Delete vendor
// @access  Private (Admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });

  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting vendor'
    });
  }
});

module.exports = router;
