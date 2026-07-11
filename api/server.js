const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  next();
});

app.use(express.static(path.join(__dirname, '../public')));

// Google Sheet ID - ခင်ဗျားရဲ့ Sheet ID
const SHEET_ID = '1EaSe24pRjpDa5JgVT44N0wM9n3o3Jc4X5-CYx-HiOsY';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// Get all videos from Google Sheet
app.get('/api/videos', async (req, res) => {
  try {
    console.log('Fetching videos from Google Sheet...');
    const response = await axios.get(SHEET_URL);
    const csvData = response.data;
    const lines = csvData.split('\n');
    
    const videos = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = [];
      let current = '';
      let inQuotes = false;
      
      for (let char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          columns.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      columns.push(current.trim());
      
      const videoUrl = columns[0] || '';
      const srtUrl = columns[1] || '';
      const title = columns[2] || 'Untitled';
      
      if (videoUrl) {
        let videoId = `video_${i}`;
        if (videoUrl.includes('youtube.com/watch')) {
          const match = videoUrl.match(/[?&]v=([^&]+)/);
          if (match) videoId = match[1];
        } else if (videoUrl.includes('youtu.be')) {
          const match = videoUrl.match(/youtu\.be\/([^?]+)/);
          if (match) videoId = match[1];
        }
        
        videos.push({
          videoId: videoId,
          title: title || `Video ${i}`,
          videoUrl: videoUrl,
          srtUrl: srtUrl
        });
      }
    }
    
    console.log('Total videos found:', videos.length);
    
    res.json({
      success: true,
      videos: videos
    });
    
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch videos',
      error: error.message
    });
  }
});

// Get single video by ID with SRT
app.get('/api/video/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  try {
    const response = await axios.get(SHEET_URL);
    const csvData = response.data;
    const lines = csvData.split('\n');
    
    let videoData = null;
    let subtitles = '';
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = [];
      let current = '';
      let inQuotes = false;
      
      for (let char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          columns.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      columns.push(current.trim());
      
      const videoUrl = columns[0] || '';
      const srtUrl = columns[1] || '';
      const title = columns[2] || 'Untitled';
      
      let vid = `video_${i}`;
      if (videoUrl.includes('youtube.com/watch')) {
        const match = videoUrl.match(/[?&]v=([^&]+)/);
        if (match) vid = match[1];
      } else if (videoUrl.includes('youtu.be')) {
        const match = videoUrl.match(/youtu\.be\/([^?]+)/);
        if (match) vid = match[1];
      }
      
      if (vid === videoId) {
        videoData = {
          videoId: vid,
          title: title || `Video ${i}`,
          videoUrl: videoUrl,
          srtUrl: srtUrl
        };
        
        if (srtUrl && srtUrl.startsWith('http')) {
          try {
            const srtRes = await axios.get(srtUrl);
            subtitles = srtRes.data;
          } catch(e) {
            console.log('No SRT file found');
          }
        }
        break;
      }
    }
    
    if (videoData) {
      res.json({
        success: true,
        video: videoData,
        subtitles: subtitles
      });
    } else {
      res.json({
        success: false,
        message: 'Video not found'
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch video',
      error: error.message
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
