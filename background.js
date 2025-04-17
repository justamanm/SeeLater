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
  
  // 使用URL和标准通用API检测缩略图，无需脚本执行权限
  
  // 检查是否是YouTube链接
  if (tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be/')) {
    let videoId = '';
    
    // 从YouTube URL提取视频ID
    if (tab.url.includes('youtube.com/watch')) {
      const url = new URL(tab.url);
      videoId = url.searchParams.get('v');
    } else if (tab.url.includes('youtu.be/')) {
      videoId = tab.url.split('youtu.be/')[1].split('?')[0];
    }
    
    if (videoId) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  } 
  // 检查是否是Twitter/X链接
  else if (tab.url.includes('twitter.com/') || tab.url.includes('x.com/')) {
    // 使用Twitter的默认图标
    thumbnail = 'https://abs.twimg.com/responsive-web/web/icon-default.3c3b2244.png';
  }
  // 对其他网站使用网站favicon作为缩略图
  else {
    const domain = new URL(tab.url).hostname;
    thumbnail = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  }
  
  return { thumbnail };
}