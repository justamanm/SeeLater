// 全局变量
let currentTags = new Set();
let activePageId = null;  // 编辑页面标签时，显示当前页面的标签

// 全局函数 - 确保在window对象上可以访问
function removeTag(tag) {
  currentTags.delete(tag);
  renderCurrentTags();
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSavedPages();
  setupEventListeners();
  refreshTagsFilter()
});

function setupEventListeners() {
  // 保存当前页面
  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.addEventListener('click', handleSaveCurrentPage);
  }

  // 搜索和过滤
  const searchBox = document.getElementById('searchBox');
  if (searchBox) {
    searchBox.addEventListener('input', handleSearch);
  }

  const tagFilter = document.getElementById('tagFilter');
  if (tagFilter) {
    tagFilter.addEventListener('click', refreshTagsFilter);
    tagFilter.addEventListener('change', handleTagFilter);
  }

  // 导入/导出按钮
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      handleExport();
    });
  }

  const importBtn = document.getElementById('importBtn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      handleImport();
    });
  }

  // 导入/导出模态框按钮
  const confirmImportExportBtn = document.getElementById('confirmImportExportBtn');
  if (confirmImportExportBtn) {
    confirmImportExportBtn.addEventListener('click', handleImportExportConfirm);
  }

  const cancelImportExportBtn = document.getElementById('cancelImportExportBtn');
  if (cancelImportExportBtn) {
    cancelImportExportBtn.addEventListener('click', () => closeModals());
  }

  // 同步按钮
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => handleSync());
  }

  // 标签管理按钮
  // 使用事件委托监听删除按钮点击事件
  const tagContainer = document.getElementById('currentTags');
  tagContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('remove')) {
      const tag = event.target.getAttribute('data-tag');
      if (tag) {
        removeTag(tag);
      }
    }
  });

  const newTagAdd = document.getElementById('newTagAdd');
  if (newTagAdd) {
    newTagAdd.addEventListener('click', handleNewTagInput);
  }

  const saveTagsBtn = document.getElementById('saveTagsBtn');
  if (saveTagsBtn) {
    saveTagsBtn.addEventListener('click', () => handleTagsSave());
  }

  const cancelTagsBtn = document.getElementById('cancelTagsBtn');
  if (cancelTagsBtn) {
    cancelTagsBtn.addEventListener('click', () => closeModals());
  }

}

// 页面元数据获取
async function getPageMetadata(tab) {
  let thumbnail = '';
  
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const ogImage = document.querySelector('meta[property="og:image"]');
        const thumbnail = ogImage ? ogImage.content : '';
        
        const isYouTube = window.location.hostname.includes('youtube.com');
        const videoId = isYouTube ? new URLSearchParams(window.location.search).get('v') : null;
        
        return { thumbnail, videoId };
      }
    });
    
    const { thumbnail: ogThumbnail, videoId } = result.result;
    
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

// 保存页面相关函数
async function handleSaveCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await savePage(tab);
  loadSavedPages();
}

// 存储在storage中的数组，每个元素代表一个页面，在页面对象上保存着相关数据
async function savePage(tab) {
  try {
    const savedPages = await chrome.storage.local.get('pages');
    const pages = savedPages.pages || [];
    
    const metadata = await getPageMetadata(tab);
    
    const newPage = {
      id: Date.now(),
      url: tab.url,
      title: tab.title,
      thumbnail: metadata.thumbnail,
      timestamp: new Date().toISOString(),
      tags: [],
      lastSync: null
    };
    
    pages.push(newPage);
    await chrome.storage.local.set({ pages });
    showSuccess('Page saved successfully!');
    
    // 自动同步
    if (await shouldAutoSync()) {
      handleSync();
    }
  } catch (error) {
    console.error('Error saving page:', error);
    showError('Failed to save page');
  }
}

// 加载和渲染页面
async function loadSavedPages() {
  const searchTerm = document.getElementById('searchBox').value.toLowerCase();
  const selectedTag = document.getElementById('tagFilter').value;
  await filterPages(searchTerm, selectedTag);
}

// 搜索页面
async function handleSearch() {
  const searchTerm = document.getElementById('searchBox').value.toLowerCase();
  const selectedTag = document.getElementById('tagFilter').value; // 保持与过滤器一致
  await filterPages(searchTerm, selectedTag);
}

async function filterPages(searchTerm, selectedTag) {
  const savedPages = await chrome.storage.local.get('pages');
  const pages = savedPages.pages || [];
  
  // 筛选页面
  const filteredPages = pages.filter(page => {
    const matchesSearch = searchTerm
      ? page.title.toLowerCase().includes(searchTerm) ||
        page.url.toLowerCase().includes(searchTerm)
      : true;
    const matchesTag = selectedTag
     ? page.tags.includes(selectedTag) || selectedTag === 'All Tags'
     : true;
    return matchesSearch && matchesTag;
  });

  renderPages(filteredPages); // 更新显示的页面列表
}



// 标签管理
// 刷新tag列表
async function refreshTagsFilter() {
  const savedPages = await chrome.storage.local.get('pages');
  const pages = savedPages.pages || [];
  
  // 收集所有唯一的标签
  const allTags = new Set();
  pages.forEach(page => {
    page.tags.forEach(tag => allTags.add(tag));
  });

  // 获取下拉框元素
  const select = document.getElementById('tagFilter');

  // 保存之前的选中值
  const previousSelectedTag = select.value;

  // 清空现有选项
  select.innerHTML = '<option value="">All Tags</option>';
  
  // 添加每个标签为选项
  Array.from(allTags).sort().forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    select.appendChild(option);
  });

  // 恢复之前的选中状态（如果之前选中的标签还存在）
  if (Array.from(allTags).includes(previousSelectedTag)) {
    select.value = previousSelectedTag;
  }
}

// 切换tag
async function handleTagFilter() {
  const searchTerm = ''
  const selectedTag = document.getElementById('tagFilter').value;
  await filterPages(searchTerm, selectedTag);
}

// 点击Edit tags
async function showTagsModal(pageId) {
  const modal = document.getElementById('addTagModal');
  if (!modal) return;

  const savedPages = await chrome.storage.local.get('pages');
  const pages = savedPages.pages || [];
  const page = pages.find(p => p.id === pageId);
  
  if (page) {
    activePageId = pageId;
    currentTags = new Set(page.tags);
    renderCurrentTags();
    modal.style.display = 'flex';
  }
}

// 点击add
function handleNewTagInput(e) {
  const newTagInput = document.getElementById('newTagInput');
  const tagName = newTagInput.value.trim();
  if (tagName) {
    currentTags.add(tagName);
    newTagInput.value = '';
    renderCurrentTags();
  }
}

// 在Edit tags页面中，显示当前页面的所有标签
function renderCurrentTags() {
  const container = document.getElementById('currentTags');
  container.innerHTML = '';
  
  Array.from(currentTags).forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    // tagElement.innerHTML = `
    //   ${tag}
    //   <span class="remove" onclick="removeTag('${tag}')">&times;</span>
    // `;
    tagElement.innerHTML = `
      ${tag}
      <span class="remove" data-tag="${tag}">&times;</span>
    `;
    container.appendChild(tagElement);
  });
}

// 点击save
async function handleTagsSave() {
  if (!activePageId) return;
  
  const savedPages = await chrome.storage.local.get('pages');
  const pages = savedPages.pages || [];
  
  const pageIndex = pages.findIndex(p => p.id === activePageId);
  if (pageIndex !== -1) {
    pages[pageIndex].tags = Array.from(currentTags);
    await chrome.storage.local.set({ pages });
    closeModals();
    loadSavedPages();
    refreshTagsFilter()
    showSuccess('Tags updated successfully!');
  }
}

function closeModals() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.style.display = 'none';
  });
  activePageId = null;
  currentTags.clear();
}


// 导入导出功能
async function handleExport() {
  try {
    const savedPages = await chrome.storage.local.get('pages');
    const exportData = JSON.stringify(savedPages.pages || [], null, 2);
    
    const modal = document.getElementById('importExportModal');
    const textarea = document.getElementById('importExportData');
    const modalTitle = document.getElementById('modalTitle');
    
    if (modal && textarea && modalTitle) {
      modalTitle.textContent = 'Export Data';
      textarea.value = exportData;
      modal.style.display = 'flex';
    }
  } catch (error) {
    showError('Failed to export data');
    console.error('Export error:', error);
  }
}

function handleImport() {
  const modal = document.getElementById('importExportModal');
  const textarea = document.getElementById('importExportData');
  const modalTitle = document.getElementById('modalTitle');
  
  if (modal && textarea && modalTitle) {
    modalTitle.textContent = 'Import Data';
    textarea.value = '';
    modal.style.display = 'flex';
  }
}

async function handleImportExportConfirm() {
  const modalTitle = document.getElementById('modalTitle').textContent;
  const textarea = document.getElementById('importExportData');
  
  if (modalTitle === 'Import Data') {
    try {
      const importData = JSON.parse(textarea.value);
      await chrome.storage.local.set({ pages: importData });
      loadSavedPages();
      refreshTagsFilter()
      showSuccess('Data imported successfully');
    } catch (error) {
      showError('Invalid import data');
    }
  }
  
  closeModals();
}

// 云同步功能
async function handleSync() {
  const syncBtn = document.getElementById('syncBtn');
  if (!syncBtn) return;
  syncBtn.textContent = 'Syncing...';

  // const syncStatus = document.createElement('div');
  // syncStatus.className = 'sync-status';
  // syncStatus.textContent = 'Syncing...';
  // syncBtn.appendChild(syncStatus);
  
  try {
    // 模拟同步过程
    await new Promise(resolve => setTimeout(resolve, 1000));
    showSuccess('Sync completed!');
  } catch (error) {
    showError('Sync failed');
  } finally {
    // syncStatus.remove();
    syncBtn.textContent = 'Sync';
  }
}


// 自动同步检查
async function shouldAutoSync() {
  // 这里可以添加自动同步的判断逻辑
  return false; // 暂时返回false
}



// 页面渲染
function renderPages(pages) {
  const container = document.getElementById('pagesList');
  const searchTerm = document.getElementById('searchBox').value.toLowerCase(); // 获取搜索关键字
  container.innerHTML = '';
  
  if (pages.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #666;">No saved pages found</div>';
    return;
  }
  
  pages.reverse().forEach(page => {
    const card = createPageCard(page, searchTerm); // 将 searchTerm 传递到卡片创建函数
    container.appendChild(card);
  });
}

function highlightText(text, searchTerm) {
  if (!searchTerm) return text;
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<span style="background-color: yellow;">$1</span>');
}

function createPageCard1(page) {
  const card = document.createElement('div');
  card.className = 'page-card';
  
  const thumbnailImg = document.createElement('img');
  thumbnailImg.className = 'thumbnail';
  thumbnailImg.src = page.thumbnail || 'placeholder.png';
  thumbnailImg.onerror = () => { thumbnailImg.src = 'placeholder.png'; };
  
  const info = document.createElement('div');
  info.className = 'page-info';
  
  const title = document.createElement('div');
  title.className = 'page-title';
  title.textContent = page.title;
  
  const tags = document.createElement('div');
  tags.className = 'page-tags';
  page.tags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.textContent = tag;
    tags.appendChild(tagElement);
  });
  
  const timestamp = document.createElement('div');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date(page.timestamp).toLocaleString();
  
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  
  const editTags = document.createElement('button');
  editTags.className = 'secondary-btn';
  editTags.textContent = 'Edit Tags';
  editTags.onclick = (e) => {
    e.stopPropagation();
    showTagsModal(page.id);
  };
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'secondary-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = async (e) => {
    e.stopPropagation();
    await deletePage(page.id);
    loadSavedPages();
  };
  
  info.appendChild(title);
  info.appendChild(tags);
  info.appendChild(timestamp);
  
  actions.appendChild(editTags);
  actions.appendChild(deleteBtn);
  
  card.appendChild(thumbnailImg);
  card.appendChild(info);
  card.appendChild(actions);
  
  card.onclick = () => {
    chrome.tabs.create({ url: page.url });
  };
  
  return card;
}


function createPageCard(page, searchTerm) {
  const card = document.createElement('div');
  card.className = 'page-card';
  
  const thumbnailImg = document.createElement('img');
  thumbnailImg.className = 'thumbnail';
  thumbnailImg.src = page.thumbnail || 'placeholder.png';
  thumbnailImg.onerror = () => { thumbnailImg.src = 'placeholder.png'; };
  
  const info = document.createElement('div');
  info.className = 'page-info';
  
  // 高亮标题
  const title = document.createElement('div');
  title.className = 'page-title';
  title.innerHTML = highlightText(page.title, searchTerm); // 使用 highlightText
  
  // 高亮 URL（可选）
  const url = document.createElement('div');
  url.className = 'page-url'; // 使用类似样式
  url.innerHTML = highlightText(page.url, searchTerm); // 使用 highlightText
  
  const tags = document.createElement('div');
  tags.className = 'page-tags';
  page.tags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.textContent = tag;
    tags.appendChild(tagElement);
  });
  
  const timestamp = document.createElement('div');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date(page.timestamp).toLocaleString();
  
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  
  const editTags = document.createElement('button');
  editTags.className = 'secondary-btn';
  editTags.textContent = 'Edit Tags';
  editTags.onclick = (e) => {
    e.stopPropagation();
    showTagsModal(page.id);
  };
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'secondary-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = async (e) => {
    e.stopPropagation();
    await deletePage(page.id);
    await refreshTagsFilter()
    await loadSavedPages()
  };
  
  info.appendChild(title);
  info.appendChild(url); // 添加高亮的 URL
  info.appendChild(tags);
  info.appendChild(timestamp);
  
  actions.appendChild(editTags);
  actions.appendChild(deleteBtn);
  
  card.appendChild(thumbnailImg);
  card.appendChild(info);
  card.appendChild(actions);
  
  card.onclick = () => {
    chrome.tabs.create({ url: page.url });
  };
  
  return card;
}

// 删除页面
async function deletePage(id) {
  const savedPages = await chrome.storage.local.get('pages');
  const pages = savedPages.pages || [];
  const updatedPages = pages.filter(page => page.id !== id);
  await chrome.storage.local.set({ pages: updatedPages });
  showSuccess('Page deleted successfully');
}


// 添加显示/隐藏通知的辅助函数
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#4CAF50' : '#f44336'};
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 1000;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}


function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

