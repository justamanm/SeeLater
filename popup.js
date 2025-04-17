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
    
    // 检查是否是斗鱼直播链接
    else if (tab.url.includes('douyu.com/')) {
      let roomId = '';
      let is_topic = false;
      // 检查是否是主题页面格式URL（包含rid参数）
      const topicRidMatch = tab.url.match(/douyu\.com\/topic\/.*?\?.*?rid=(\d+)/);
      if (topicRidMatch && topicRidMatch[1]) {
        roomId = topicRidMatch[1];
        is_topic = true;
      } 
      // 否则尝试普通直播间URL格式
      else {
        const roomMatch = tab.url.match(/douyu\.com\/(\d+)/);
        if (roomMatch && roomMatch[1]) {
          roomId = roomMatch[1];
        }
      }
      
      // 如果成功获取到房间ID，继续获取缩略图
      if (roomId) {
        // 使用斗鱼API获取直播间信息，包括缩略图
        try {
          const response = await fetch(`https://www.douyu.com/betard/${roomId}`);
          const data = await response.json();
          
          // 检查room属性是否存在
          if (data && data.room) {
            const roomInfo = data.room;
            
            // 如果API请求成功并返回了直播间缩略图
            if (roomInfo.room_src) {
              console.log(roomInfo.room_src);
              console.log(roomInfo.coverSrc);
              console.log(is_topic);
              let roomSrc;
              if (is_topic && roomInfo.coverSrc) {
                roomSrc = roomInfo.coverSrc
              } else {
                roomSrc = roomInfo.room_src;
              }
              // 将dy4替换为dy1获取不同尺寸的缩略图
              if (roomSrc.endsWith('dy4')) {
                roomSrc = roomSrc.replace(/dy4$/, 'dy1');
              }
              if (is_topic) {
                thumbnail = roomSrc
              } else {
                thumbnail = `https://rpic.douyucdn.cn/${roomSrc}`; // 拼接完整缩略图URL
              }
            } else {
              // 如果没有获取到缩略图，使用斗鱼默认图标
              thumbnail = 'https://sta-op.douyucdn.cn/douyu-ndm/assets/favicon.ico';
            }
          } else {
            // API请求失败或数据格式不符，使用默认图标
            thumbnail = 'https://sta-op.douyucdn.cn/douyu-ndm/assets/favicon.ico';
          }
        } catch (error) {
          console.error('获取斗鱼直播间信息失败:', error);
          thumbnail = 'https://sta-op.douyucdn.cn/douyu-ndm/assets/favicon.ico';
        }
      }
    }
    
    // 检查是否是Bilibili普通视频链接
    else if (tab.url.includes('bilibili.com/video/')) {
      let bvid = '';
      
      // 从Bilibili URL提取视频ID (BV号)
      const bvMatch = tab.url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
      if (bvMatch && bvMatch[1]) {
        bvid = bvMatch[1];
        
        // 使用B站API获取视频信息，包括封面图
        try {
          const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
          const data = await response.json();
          
          // 如果API请求成功并返回了视频信息
          if (data && data.code === 0 && data.data && data.data.pic) {
            thumbnail = data.data.pic; // 使用视频实际封面图
          } else {
            // API请求失败，使用默认图标
            thumbnail = 'https://www.bilibili.com/favicon.ico';
          }
        } catch (error) {
          console.error('获取B站视频信息失败:', error);
          thumbnail = 'https://www.bilibili.com/favicon.ico';
        }
      }
    }
    // 检查是否是Bilibili剧集/番剧链接 (ep格式)
    else if (tab.url.includes('bilibili.com/bangumi/play/ep')) {
      let epId = '';
      
      // 从Bilibili URL提取剧集ID (ep_id)
      const epMatch = tab.url.match(/play\/ep(\d+)/);
      if (epMatch && epMatch[1]) {
        epId = epMatch[1];
        
        // 使用B站剧集API获取视频信息，包括封面图
        try {
          const response = await fetch(`https://api.bilibili.com/pgc/view/web/season?ep_id=${epId}`);
          const data = await response.json();
          
          // 如果API请求成功并返回了剧集信息
          if (data && data.code === 0 && data.result && data.result.cover) {
            thumbnail = data.result.cover; // 使用剧集实际封面图
          } else {
            // API请求失败，使用默认图标
            thumbnail = 'https://www.bilibili.com/favicon.ico';
          }
        } catch (error) {
          console.error('获取B站剧集信息失败:', error);
          thumbnail = 'https://www.bilibili.com/favicon.ico';
        }
      }
    }
    // 检查是否是Bilibili剧集/番剧链接 (ss格式)
    else if (tab.url.includes('bilibili.com/bangumi/play/ss')) {
      let seasonId = '';
      
      // 从Bilibili URL提取剧集ID (season_id)
      const ssMatch = tab.url.match(/play\/ss(\d+)/);
      if (ssMatch && ssMatch[1]) {
        seasonId = ssMatch[1];
        
        try {
          // 第一步：通过season_id获取剧集列表，提取第一集的ep_id
          const episodeListResponse = await fetch(`https://api.bilibili.com/pgc/view/web/ep/list?season_id=${seasonId}`);
          const episodeListData = await episodeListResponse.json();
          
          if (episodeListData && episodeListData.code === 0 && 
              episodeListData.result && episodeListData.result.episodes && 
              episodeListData.result.episodes.length > 0 && 
              episodeListData.result.episodes[0].ep_id) {
            
            const epId = episodeListData.result.episodes[0].ep_id;
            
            // 第二步：通过获取到的ep_id获取剧集信息，包括封面图
            const response = await fetch(`https://api.bilibili.com/pgc/view/web/season?ep_id=${epId}`);
            const data = await response.json();
            
            // 如果API请求成功并返回了剧集信息
            if (data && data.code === 0 && data.result && data.result.cover) {
              thumbnail = data.result.cover; // 使用剧集实际封面图
            } else {
              // API请求失败，使用默认图标
              thumbnail = 'https://www.bilibili.com/favicon.ico';
            }
          } else {
            // 获取剧集列表失败，使用默认图标
            thumbnail = 'https://www.bilibili.com/favicon.ico';
          }
        } catch (error) {
          console.error('获取B站剧集信息失败:', error);
          thumbnail = 'https://www.bilibili.com/favicon.ico';
        }
      }
    }
    // 检查是否是Vimeo链接
    else if (tab.url.includes('vimeo.com/')) {
      let vimeoId = '';
      
      // 从Vimeo URL提取视频ID
      const vimeoMatch = tab.url.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch && vimeoMatch[1]) {
        vimeoId = vimeoMatch[1];
        thumbnail = `https://i.vimeocdn.com/video/${vimeoId}_640.jpg`;
      }
    }
    // 检查是否是优酷链接
    else if (tab.url.includes('youku.com/')) {
      try {
        // 直接请求当前URL获取页面内容
        const response = await fetch(tab.url);
        const html = await response.text();
        
        // 使用正则表达式从页面内容中提取封面图URL
        const showImgMatch = html.match(/"showImgV":\s*"([^"]+)"/);
        
        if (showImgMatch && showImgMatch[1]) {
          // 提取到封面图URL，需要处理转义字符
          let imgUrl = showImgMatch[1];
          
          // 将Unicode转义序列(\u002F)转换为实际字符(/)
          imgUrl = imgUrl.replace(/\\u002F/g, '/');
          
          // 确保URL格式正确
          if (imgUrl.startsWith('http')) {
            thumbnail = imgUrl;
          } else if (imgUrl.startsWith('//')) {
            thumbnail = 'https:' + imgUrl;
          } else if (imgUrl.startsWith('/')) {
            thumbnail = 'https://www.youku.com' + imgUrl;
          } else {
            thumbnail = 'https://' + imgUrl;
          }
        } else {
          // 如果未能提取到封面图，使用默认图标
          thumbnail = 'https://g.alicdn.com/de/youku/yx/1.0.41/favicon.ico';
        }
      } catch (error) {
        console.error('获取优酷视频信息失败:', error);
        thumbnail = 'https://g.alicdn.com/de/youku/yx/1.0.41/favicon.ico';
      }
    }
    // 检查是否是腾讯视频链接
    else if (tab.url.includes('v.qq.com/')) {
      let vid = '';
      
      // 尝试从腾讯视频URL提取视频ID
      const vidMatch = tab.url.match(/\/([a-zA-Z0-9]+)\.html/);
      if (vidMatch && vidMatch[1]) {
        vid = vidMatch[1];
        thumbnail = 'https://images.weserv.nl/?url=https://v.qq.com/favicon.ico&w=128&h=128';
      }
    }
    // 检查是否是爱奇艺链接
    else if (tab.url.includes('iqiyi.com/')) {
      thumbnail = 'https://images.weserv.nl/?url=https://www.iqiyi.com/favicon.ico&w=128&h=128';
    }
    // 检查是否是Netflix链接
    else if (tab.url.includes('netflix.com/')) {
      thumbnail = 'https://images.weserv.nl/?url=https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png&w=128&h=128';
    }
    // 检查是否是芒果TV链接
    else if (tab.url.includes('mgtv.com/')) {
      try {
        // 请求当前页面获取内容
        const response = await fetch(tab.url);
        const html = await response.text();
        
        // 使用正则表达式从页面内容中提取thumbnailUrl数组
        const thumbnailUrlMatch = html.match(/"thumbnailUrl":\s*\[\s*"([^"]+)"/);
        
        if (thumbnailUrlMatch && thumbnailUrlMatch[1]) {
          // 获取到第一个缩略图URL
          thumbnail = thumbnailUrlMatch[1];
        } else {
          // 如果未能提取到缩略图，使用芒果TV默认图标
          thumbnail = 'https://img.mgtv.com/imgotv-member/favicon.ico';
        }
      } catch (error) {
        console.error('获取芒果TV视频信息失败:', error);
        thumbnail = 'https://img.mgtv.com/imgotv-member/favicon.ico';
      }
    }
    // 检查是否是Twitter/X链接
    else if (tab.url.includes('twitter.com/') || tab.url.includes('x.com/')) {
      // 使用Google的favicon服务获取X的图标，更可靠
      thumbnail = 'https://www.google.com/s2/favicons?domain=x.com&sz=128';
    }
    // 对其他网站使用网站favicon作为缩略图
    else {
      const domain = new URL(tab.url).hostname;
      thumbnail = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
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
    showSuccess('页面保存成功！');
    
    // 自动同步
    if (await shouldAutoSync()) {
      handleSync();
    }
  } catch (error) {
    console.error('Error saving page:', error);
    showError('保存页面失败');
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
     ? page.tags.includes(selectedTag) || selectedTag === '所有标签'
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
  select.innerHTML = '<option value="">所有标签</option>';
  
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
    showSuccess('标签更新成功！');
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
      modalTitle.textContent = '导出数据';
      textarea.value = exportData;
      modal.style.display = 'flex';
    }
  } catch (error) {
    showError('导出数据失败');
    console.error('Export error:', error);
  }
}

function handleImport() {
  const modal = document.getElementById('importExportModal');
  const textarea = document.getElementById('importExportData');
  const modalTitle = document.getElementById('modalTitle');
  
  if (modal && textarea && modalTitle) {
    modalTitle.textContent = '导入数据';
    textarea.value = '';
    modal.style.display = 'flex';
  }
}

async function handleImportExportConfirm() {
  const modalTitle = document.getElementById('modalTitle').textContent;
  const textarea = document.getElementById('importExportData');
  
  if (modalTitle === '导入数据') {
    try {
      const importData = JSON.parse(textarea.value);
      await chrome.storage.local.set({ pages: importData });
      loadSavedPages();
      refreshTagsFilter()
      showSuccess('数据导入成功');
    } catch (error) {
      showError('导入数据无效');
    }
  }
  
  closeModals();
}

// 云同步功能
async function handleSync() {
  const syncBtn = document.getElementById('syncBtn');
  if (!syncBtn) return;
  syncBtn.textContent = '同步中...';
  
  try {
    // 模拟同步过程
    await new Promise(resolve => setTimeout(resolve, 1000));
    showSuccess('同步完成！');
  } catch (error) {
    showError('同步失败');
  } finally {
    syncBtn.textContent = '同步';
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
    // 使用新的空白状态样式，确保消息跨越所有列
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = '没有找到已保存的页面';
    container.appendChild(emptyState);
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

function createPageCard(page, searchTerm) {
  const card = document.createElement('div');
  card.className = 'page-card';
  
  // 整个卡片点击打开URL
  card.addEventListener('click', () => {
    chrome.tabs.create({ url: page.url });
  });
  
  // 缩略图
  const thumbnailImg = document.createElement('img');
  thumbnailImg.className = 'thumbnail';
  thumbnailImg.src = page.thumbnail || 'placeholder.png';
  thumbnailImg.onerror = () => { thumbnailImg.src = 'placeholder.png'; };
  
  // 信息区
  const info = document.createElement('div');
  info.className = 'page-info';
  
  // 高亮标题
  const title = document.createElement('div');
  title.className = 'page-title';
  
  // 处理标题，确保即使有高亮也能正确显示省略号
  const titleText = highlightText(page.title || '无标题', searchTerm);
  title.innerHTML = titleText;
  title.title = page.title || '无标题'; // 添加完整标题作为提示
  
  // 高亮 URL
  const url = document.createElement('div');
  url.className = 'page-url';
  url.innerHTML = highlightText(page.url || '#', searchTerm);
  url.title = page.url || '#'; // 添加完整URL作为提示
  
  // 标签容器
  const tags = document.createElement('div');
  tags.className = 'page-tags';
  
  // 最多显示1个标签，超过则显示"+n"
  const maxVisibleTags = 1; // 减少为1个，节省空间
  if (page.tags && page.tags.length > 0) {
    const visibleTags = page.tags.slice(0, maxVisibleTags);
    visibleTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag';
      tagElement.textContent = tag;
      tags.appendChild(tagElement);
    });
    
    // 如果有更多标签，添加+n标签
    if (page.tags.length > maxVisibleTags) {
      const moreTag = document.createElement('span');
      moreTag.className = 'tag';
      moreTag.textContent = `+${page.tags.length - maxVisibleTags}`;
      
      // 鼠标悬停时显示所有标签
      const allTags = page.tags.join(', ');
      moreTag.title = allTags;
      
      tags.appendChild(moreTag);
    }
  }
  
  // 时间戳
  const timestamp = document.createElement('div');
  timestamp.className = 'timestamp';
  
  // 格式化日期，只显示日期部分，不显示时间，节省空间
  const date = new Date(page.timestamp);
  // 使用更紧凑的日期格式，例如"MM-DD"
  const month = date.getMonth() + 1;
  const day = date.getDate();
  timestamp.textContent = `${month}-${day}`;
  timestamp.title = date.toLocaleString(); // 完整时间作为提示
  
  // 操作按钮区
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  
  // 编辑标签按钮
  const editTags = document.createElement('button');
  editTags.className = 'secondary-btn';
  editTags.textContent = '标签'; // 缩短文本
  editTags.title = '编辑标签'; // 添加提示
  editTags.onclick = (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    showTagsModal(page.id);
  };
  
  // 删除按钮
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'secondary-btn';
  deleteBtn.textContent = '删除';
  deleteBtn.onclick = async (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    await deletePage(page.id);
    await refreshTagsFilter();
    await loadSavedPages();
  };
  
  // 组装信息区
  info.appendChild(title);
  info.appendChild(url);
  info.appendChild(tags);
  info.appendChild(timestamp);
  
  // 组装操作区
  actions.appendChild(editTags);
  actions.appendChild(deleteBtn);
  
  // 组装卡片
  card.appendChild(thumbnailImg);
  card.appendChild(info);
  card.appendChild(actions);
  
  return card;
}

// 删除页面
async function deletePage(id) {
  const savedPages = await chrome.storage.local.get('pages');
  const pages = savedPages.pages || [];
  const updatedPages = pages.filter(page => page.id !== id);
  await chrome.storage.local.set({ pages: updatedPages });
  showSuccess('页面删除成功');
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
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 1000;
    font-size: 13px;
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

