chrome.action.onClicked.addListener((tab) => {
  savePage(tab);
});

async function savePage(tab) {
  try {
    const savedPages = await chrome.storage.local.get('pages');
    const pages = savedPages.pages || [];
    
    // Get page metadata
    const metadata = await getPageMetadata(tab);
    
    pages.push({
      id: Date.now(),
      url: tab.url,
      title: tab.title,
      thumbnail: metadata.thumbnail,
      timestamp: new Date().toISOString(),
    });
    
    await chrome.storage.local.set({ pages });
  } catch (error) {
    console.error('Error saving page:', error);
  }
}

async function getPageMetadata(tab) {
  let thumbnail = '';
  
  // Execute content script to get metadata
  const result = await chrome.tabs.executeScript(tab.id, {
    code: `
      const ogImage = document.querySelector('meta[property="og:image"]');
      const thumbnail = ogImage ? ogImage.content : '';
      
      // Special handling for YouTube
      const isYouTube = window.location.hostname.includes('youtube.com');
      const videoId = isYouTube ? new URLSearchParams(window.location.search).get('v') : null;
      
      ({ thumbnail, videoId });
    `
  });
  
  const { thumbnail: ogThumbnail, videoId } = result[0];
  
  // If it's YouTube, use video thumbnail
  if (videoId) {
    thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  } else {
    thumbnail = ogThumbnail;
  }
  
  return { thumbnail };
}