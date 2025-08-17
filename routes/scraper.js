const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// @route   POST /api/scraper/start
// @desc    Start automated data collection
// @access  Private (Admin only)
router.post('/start', async (req, res) => {
  try {
    const { source, data_type, location } = req.body;

    // Validate input
    if (!source || !data_type) {
      return res.status(400).json({
        success: false,
        message: 'Source aur data type required hain'
      });
    }

    // Log scraping job
    const { data: jobData, error: jobError } = await supabase
      .from('scraping_jobs')
      .insert([
        {
          source,
          data_type,
          location,
          status: 'started',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (jobError) {
      return res.status(400).json({
        success: false,
        message: jobError.message
      });
    }

    // TODO: Implement actual scraping logic
    // This would trigger background jobs for:
    // - Instagram food posts scraping
    // - YouTube food vlogger data collection
    // - Google Places vendor information
    // - Zomato/Swiggy data extraction

    res.status(201).json({
      success: true,
      message: 'Data collection job started successfully',
      job_id: jobData.id,
      estimated_time: '15-30 minutes'
    });

  } catch (error) {
    console.error('Start scraper error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error starting data collection'
    });
  }
});

// @route   GET /api/scraper/jobs
// @desc    Get scraping job status
// @access  Private
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('scraping_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
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
      jobs: data
    });

  } catch (error) {
    console.error('Get scraper jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting scraper jobs'
    });
  }
});

// @route   GET /api/scraper/stats
// @desc    Get scraping statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    // Get total counts
    const { data: vendorCount } = await supabase
      .from('vendors')
      .select('id', { count: 'exact' });

    const { data: vloggerCount } = await supabase
      .from('vloggers')
      .select('id', { count: 'exact' });

    const { data: mediaCount } = await supabase
      .from('media')
      .select('id', { count: 'exact' });

    const { data: recentJobs } = await supabase
      .from('scraping_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      success: true,
      stats: {
        total_vendors: vendorCount?.length || 0,
        total_vloggers: vloggerCount?.length || 0,
        total_media: mediaCount?.length || 0,
        recent_jobs: recentJobs || []
      }
    });

  } catch (error) {
    console.error('Get scraper stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting scraper stats'
    });
  }
});

module.exports = router;
