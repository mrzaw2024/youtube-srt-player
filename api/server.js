const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API: Fetch video info and subtitles
app.get('/api/video/:videoId', async (req, res) => {
    const { videoId } = req.params;
    
    try {
        // Fetch video info from YouTube
        const videoInfo = await getVideoInfo(videoId);
        
        // Try to fetch subtitles
        let subtitles = [];
        try {
            subtitles = await fetchSubtitles(videoId);
        } catch (e) {
            console.log('No subtitles available');
        }
        
        res.json({
            success: true,
            videoId,
            title: videoInfo.title || 'YouTube Video',
            subtitles: subtitles
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch video data',
            error: error.message
        });
    }
});

// Helper: Get video info
async function getVideoInfo(videoId) {
    try {
        const response = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        return { title: response.data.title || 'YouTube Video' };
    } catch {
        return { title: 'YouTube Video' };
    }
}

// Helper: Fetch subtitles
async function fetchSubtitles(videoId) {
    try {
        const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const html = response.data;
        const subtitleMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        
        if (subtitleMatch) {
            const tracks = JSON.parse(subtitleMatch[1]);
            if (tracks.length > 0) {
                const track = tracks[0];
                const subResponse = await axios.get(track.baseUrl);
                const srt = convertXMLToSRT(subResponse.data);
                return srt;
            }
        }
        return [];
    } catch (error) {
        return [];
    }
}

// Helper: Convert XML to SRT
function convertXMLToSRT(xmlData) {
    const lines = xmlData.split('\n');
    let srt = '';
    let count = 1;
    let start = '';
    let end = '';
    let text = '';
    
    for (let line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('<p')) {
            const startMatch = trimmed.match(/t="([^"]+)"/);
            const durMatch = trimmed.match(/d="([^"]+)"/);
            
            if (startMatch) {
                start = formatTime(parseFloat(startMatch[1]));
            }
            if (durMatch) {
                const duration = parseFloat(durMatch[1]);
                const startSec = parseFloat(startMatch[1]);
                const endSec = startSec + duration;
                end = formatTime(endSec);
            }
            
            const textMatch = trimmed.match(/>([^<]+)</);
            if (textMatch) {
                text = textMatch[1].trim();
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

// Helper: Format time to SRT timestamp
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export for Vercel
module.exports = app;
