const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API: Fetch video info and subtitles
app.get('/api/video/:videoId', async (req, res) => {
    const { videoId } = req.params;
    
    try {
        // Fetch video info from YouTube (using no API key, public data)
        const videoInfo = await getVideoInfo(videoId);
        
        // Try to fetch subtitles if available
        let subtitles = [];
        try {
            subtitles = await fetchSubtitles(videoId);
        } catch (e) {
            console.log('No subtitles available for this video');
        }
        
        res.json({
            success: true,
            videoId,
            title: videoInfo.title || 'YouTube Video',
            subtitles: subtitles
        });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch video data',
            error: error.message
        });
    }
});

// Helper: Get video info from YouTube
async function getVideoInfo(videoId) {
    try {
        const response = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        return {
            title: response.data.title || 'YouTube Video'
        };
    } catch {
        return { title: 'YouTube Video' };
    }
}

// Helper: Fetch subtitles (SRT format)
async function fetchSubtitles(videoId) {
    try {
        // Try to get subtitles from YouTube using alternative method
        const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Parse subtitles from page (simplified version)
        // In production, use youtube-transcript-api or similar
        const html = response.data;
        const subtitleMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        
        if (subtitleMatch) {
            const tracks = JSON.parse(subtitleMatch[1]);
            if (tracks.length > 0) {
                // Get first subtitle track
                const track = tracks[0];
                const subResponse = await axios.get(track.baseUrl);
                const srt = convertXMLToSRT(subResponse.data);
                return srt;
            }
        }
        return [];
    } catch (error) {
        console.error('Subtitle fetch error:', error.message);
        return [];
    }
}

// Helper: Convert XML to SRT format
function convertXMLToSRT(xmlData) {
    // Simple XML to SRT converter
    const lines = xmlData.split('\n');
    let srt = '';
    let count = 1;
    let start = '';
    let end = '';
    let text = '';
    
    for (let line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('<p')) {
            // Extract timing attributes
            const startMatch = trimmed.match(/t="([^"]+)"/);
            const durMatch = trimmed.match(/d="([^"]+)"/);
            
            if (startMatch) {
                start = parseTime(startMatch[1]);
            }
            if (durMatch) {
                const duration = parseFloat(durMatch[1]);
                const startSec = parseTimeToSeconds(startMatch[1]);
                const endSec = startSec + duration;
                end = formatTime(endSec);
            }
            
            // Extract text content
            const textMatch = trimmed.match(/>([^<]+)</);
            if (textMatch) {
                text = textMatch[1].trim();
                
                // If we have all needed parts, create SRT entry
                if (start && end && text) {
                    srt += `${count}\n${start} --> ${end}\n${text}\n\n`;
                    count++;
                    start = '';
                    end = '';
                    text = '';
                }
            }
        }
    }
    
    return srt;
}

// Helper: Parse time format (e.g., "123.45")
function parseTime(timeStr) {
    const seconds = parseFloat(timeStr);
    return formatTime(seconds);
}

// Helper: Format seconds to SRT timestamp (HH:MM:SS,mmm)
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

// Helper: Convert time string to seconds
function parseTimeToSeconds(timeStr) {
    return parseFloat(timeStr);
}

// Serve the main HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Open in browser: http://localhost:${PORT}`);
});
