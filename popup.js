// 保存页面的函数
async function savePage(tab) {
  try {
    const savedPages = await chrome.storage.local.get('pages');
    const pages = savedPages.pages || [];
    
    // 获取页面元数据
    const metadata = await getPageMetadata(tab);
    
    const newPage = {
      id: Date.now(),
      url: tab.url,
      title: tab.title,
      thumbnail: metadata.thumbnail,
      timestamp: new Date().toISOString(),
    };
    
    pages.push(newPage);
    await chrome.storage.local.set({ pages });
    
    // 显示保存成功的提示
    const saveButton = document.getElementById('saveButton');
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Saved!';
    saveButton.style.backgroundColor = '#45a049';
    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.style.backgroundColor = '#4CAF50';
    }, 1000);
  } catch (error) {
    console.error('Error saving page:', error);
  }
}

// 获取页面元数据的函数
async function getPageMetadata(tab) {
  let thumbnail = '';
  
  try {
    // 执行内容脚本获取元数据
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const ogImage = document.querySelector('meta[property="og:image"]');
        const thumbnail = ogImage ? ogImage.content : '';
        
        // YouTube特殊处理
        const isYouTube = window.location.hostname.includes('youtube.com');
        const videoId = isYouTube ? new URLSearchParams(window.location.search).get('v') : null;
        
        return { thumbnail, videoId };
      }
    });
    
    const { thumbnail: ogThumbnail, videoId } = result.result;
    
    // 如果是YouTube视频，使用视频缩略图
    if (videoId) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    } else {
      thumbnail = ogThumbnail;
    }
  } catch (error) {
    console.error('Error getting metadata:', error);
  }
  
  return { thumbnail };
}

// 加载已保存页面的函数
async function loadSavedPages() {
  const container = document.getElementById('pagesList');
  container.innerHTML = '';
  
  const savedPages = await chrome.storage.local.get('pages');
  const pages = savedPages.pages || [];
  
  if (pages.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #666;">No saved pages yet</div>';
    return;
  }
  
  pages.reverse().forEach(page => {
    const card = document.createElement('div');
    card.className = 'page-card';
    
    const thumbnailImg = document.createElement('img');
    thumbnailImg.className = 'thumbnail';
    thumbnailImg.src = page.thumbnail || 'placeholder.png';
    thumbnailImg.onerror = () => {
      thumbnailImg.src = 'placeholder.png';
    };
    
    const info = document.createElement('div');
    info.className = 'page-info';
    
    const title = document.createElement('div');
    title.className = 'page-title';
    title.textContent = page.title;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date(page.timestamp).toLocaleString();
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      await deletePage(page.id);
      loadSavedPages();
    };
    
    info.appendChild(title);
    info.appendChild(timestamp);
    
    card.appendChild(thumbnailImg);
    card.appendChild(info);
    card.appendChild(deleteBtn);
    
    card.onclick = (e) => {
      if (e.target !== deleteBtn) {
        chrome.tabs.create({ url: page.url });
      }
    };
    
    container.appendChild(card);
  });
}

// 删除页面的函数
async function deletePage(id) {
  const savedPages = await chrome.storage.local.get('pages');
  const pages = savedPages.pages || [];
  const updatedPages = pages.filter(page => page.id !== id);
  await chrome.storage.local.set({ pages: updatedPages });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSavedPages();
  
  document.getElementById('saveButton').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await savePage(tab);
    loadSavedPages();
  });
});