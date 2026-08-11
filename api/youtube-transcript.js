import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req, res) {
  // Add CORS headers for local development testing if needed
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing YouTube URL parameter.' });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ error: 'No transcript found for this video.' });
    }
    
    // Combine all transcript parts into a single text block
    const fullText = transcript.map(t => t.text).join(' ');
    
    return res.status(200).json({ transcript: fullText });
  } catch (error) {
    console.error('Transcript Fetch Error:', error);
    return res.status(500).json({ error: 'Failed to fetch transcript. The video might not have captions or is restricted.' });
  }
}
