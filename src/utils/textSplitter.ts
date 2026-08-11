export function splitTextIntoChunks(text: string, maxChunkSize = 4000, overlapPercentage = 0.15): string[] {
  if (!text) return [];
  
  const chunks: string[] = [];
  const overlapSize = Math.floor(maxChunkSize * overlapPercentage);
  
  let currentIndex = 0;
  while (currentIndex < text.length) {
    let endIndex = currentIndex + maxChunkSize;
    
    if (endIndex < text.length) {
      // Try to find a natural break (newline or period) near the end to avoid splitting words
      const chunkContext = text.substring(currentIndex, endIndex);
      const lastNewline = chunkContext.lastIndexOf('\n');
      const lastPeriod = chunkContext.lastIndexOf('. ');
      
      const breakPoint = Math.max(lastNewline, lastPeriod);
      
      // If a natural break is found in the last 25% of the chunk, we cut there
      if (breakPoint > maxChunkSize * 0.75) {
        endIndex = currentIndex + breakPoint + 1; // include the punctuation
      }
    } else {
      endIndex = text.length;
    }

    const chunk = text.substring(currentIndex, endIndex);
    chunks.push(chunk);
    
    if (endIndex >= text.length) {
      break;
    }
    
    // Move forward, but overlap with the end of the current chunk
    currentIndex = endIndex - overlapSize;
    
    // Failsafe to prevent infinite loops
    if (currentIndex <= chunks[chunks.length - 1].length - maxChunkSize) {
       currentIndex = endIndex;
    }
  }
  
  return chunks;
}
