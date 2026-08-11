import { YoutubeTranscript } from 'youtube-transcript';

async function test() {
  const url = 'https://youtu.be/koZiIO7nyl0?si=dXvqHrE-LIjBZy8e';
  try {
    const t = await YoutubeTranscript.fetchTranscript(url);
    console.log("Success, length:", t.length);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
