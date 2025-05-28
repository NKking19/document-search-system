// Set up PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * Document Search Professional - Working Version
 * ระบบค้นหาเอกสารขั้นสูงสำหรับองค์กร
 */
class DocumentSearchApp {
    constructor() {
        this.currentFiles = new Map();
        this.selectedFiles = new Set();
        this.searchResults = [];
        this.isSearching = false;
        this.currentViewedFile = null;
        this.currentViewedPage = 1;
        this.pdfDocument = null;
        this.currentPage = 1;
        this.currentScale = 1.0;
        this.minScale = 0.25;
        this.maxScale = 5.0;
        this.scaleStep = 0.5;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateStatistics();
        console.log('Document Search Professional initialized successfully');
    }

    bindEvents() {
        // File selection options
        const filesOption = document.getElementById('filesOption');
        const folderOption = document.getElementById('folderOption');
        
        if (filesOption) {
            filesOption.addEventListener('click', () => {
                this.setFileSelectionMode('files');
            });
        }

        if (folderOption) {
            folderOption.addEventListener('click', () => {
                this.setFileSelectionMode('folder');
            });
        }

        // File selection
        const fileInput = document.getElementById('fileInput');
        const folderInput = document.getElementById('folderInput');
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }

        if (folderInput) {
            folderInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }

        // File management
        const selectAllBtn = document.getElementById('selectAllBtn');
        const clearFilesBtn = document.getElementById('clearFilesBtn');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllFiles();
            });
        }

        if (clearFilesBtn) {
            clearFilesBtn.addEventListener('click', () => {
                this.clearAllFiles();
            });
        }

        // Search
        const searchButton = document.getElementById('searchButton');
        const cancelButton = document.getElementById('cancelButton');
        
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                this.startSearch();
            });
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                this.cancelSearch();
            });
        }

        // Export
        const exportCsv = document.getElementById('exportCsv');
        const exportJson = document.getElementById('exportJson');
        const exportPdf = document.getElementById('exportPdf');
        
        if (exportCsv) {
            exportCsv.addEventListener('click', () => {
                this.exportResults('csv');
            });
        }

        if (exportJson) {
            exportJson.addEventListener('click', () => {
                this.exportResults('json');
            });
        }

        if (exportPdf) {
            exportPdf.addEventListener('click', () => {
                this.exportResults('pdf');
            });
        }

        // Enter key search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    this.startSearch();
                }
            });
        }
    }

    setFileSelectionMode(mode) {
        const filesOption = document.getElementById('filesOption');
        const folderOption = document.getElementById('folderOption');
        const fileInput = document.getElementById('fileInput');
        const folderInput = document.getElementById('folderInput');
        const fileInputLabel = document.getElementById('fileInputLabel');

        if (!filesOption || !folderOption || !fileInput || !folderInput || !fileInputLabel) {
            return;
        }

        if (mode === 'files') {
            filesOption.classList.add('active');
            folderOption.classList.remove('active');
            fileInput.style.display = 'block';
            folderInput.style.display = 'none';
            fileInputLabel.setAttribute('for', 'fileInput');
            fileInputLabel.innerHTML = '📤 เลือกไฟล์เอกสาร';
        } else {
            filesOption.classList.remove('active');
            folderOption.classList.add('active');
            fileInput.style.display = 'none';
            folderInput.style.display = 'block';
            fileInputLabel.setAttribute('for', 'folderInput');
            fileInputLabel.innerHTML = '📁 เลือกโฟลเดอร์';
        }
    }

    async handleFileSelection(files) {
        if (!files || files.length === 0) {
            return;
        }

        const fileArray = Array.from(files);
        const supportedFiles = this.filterSupportedFiles(fileArray);
        
        if (supportedFiles.length === 0) {
            alert('ไม่พบไฟล์ที่รองรับ กรุณาเลือกไฟล์ PDF, DOC, DOCX, TXT หรือ RTF');
            return;
        }

        for (const file of supportedFiles) {
            await this.addFileToList(file);
        }
        
        this.updateFileList();
        this.updateStatistics();
    }

    filterSupportedFiles(files) {
        const supportedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
        return files.filter(file => {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            return supportedExtensions.includes(extension);
        });
    }

    async addFileToList(file) {
        const fileId = this.generateFileId(file);
        
        if (this.currentFiles.has(fileId)) {
            return;
        }

        const fileInfo = {
            id: fileId,
            file: file,
            name: file.name,
            size: file.size,
            type: this.getFileType(file.name),
            selected: true
        };

        this.currentFiles.set(fileId, fileInfo);
        this.selectedFiles.add(fileId);
    }

    getFileType(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const typeMap = {
            'pdf': 'pdf',
            'doc': 'doc',
            'docx': 'doc',
            'txt': 'txt',
            'rtf': 'rtf'
        };
        return typeMap[extension] || 'unknown';
    }

    generateFileId(file) {
        return `${file.name}_${file.size}_${file.lastModified}`;
    }

    updateFileList() {
        const fileList = document.getElementById('fileList');
        
        if (!fileList) return;

        if (this.currentFiles.size === 0) {
            fileList.innerHTML = '<div class="no-files"><p>📄 ยังไม่มีไฟล์ที่เลือก</p></div>';
            return;
        }

        let html = '';
        this.currentFiles.forEach((fileInfo) => {
            const isSelected = this.selectedFiles.has(fileInfo.id);
            const fileSize = this.formatFileSize(fileInfo.size);
            
            html += `
                <div class="file-item ${isSelected ? 'selected' : ''}" data-file-id="${fileInfo.id}">
                    <input type="checkbox" class="file-checkbox" ${isSelected ? 'checked' : ''}>
                    <div class="file-info">
                        <div class="file-name">${fileInfo.name}</div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                    <span class="file-type-badge ${fileInfo.type}">${fileInfo.type.toUpperCase()}</span>
                </div>
            `;
        });

        fileList.innerHTML = html;
        this.bindFileItemEvents();
    }

    bindFileItemEvents() {
        const fileItems = document.querySelectorAll('.file-item');
        
        fileItems.forEach(item => {
            const checkbox = item.querySelector('.file-checkbox');
            const fileId = item.dataset.fileId;
            
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggleFileSelection(fileId, checkbox.checked);
                });
            }
            
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox' && checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.toggleFileSelection(fileId, checkbox.checked);
                }
            });
        });
    }

    toggleFileSelection(fileId, selected) {
        if (selected) {
            this.selectedFiles.add(fileId);
        } else {
            this.selectedFiles.delete(fileId);
        }
        
        this.updateFileList();
        this.updateStatistics();
    }

    selectAllFiles() {
        this.currentFiles.forEach((fileInfo) => {
            this.selectedFiles.add(fileInfo.id);
        });
        this.updateFileList();
        this.updateStatistics();
    }

    clearAllFiles() {
        if (confirm('คุณต้องการล้างรายการไฟล์ทั้งหมดหรือไม่?')) {
            this.currentFiles.clear();
            this.selectedFiles.clear();
            this.searchResults = [];
            this.updateFileList();
            this.updateStatistics();
            this.clearResults();
        }
    }

    async startSearch() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;

        const searchQuery = searchInput.value.trim();
        
        if (!searchQuery) {
            alert('กรุณาใส่คำที่ต้องการค้นหา');
            return;
        }

        if (this.selectedFiles.size === 0) {
            alert('กรุณาเลือกไฟล์ที่ต้องการค้นหา');
            return;
        }

        this.isSearching = true;
        this.updateSearchUI(true);
        this.clearResults();
        this.searchResults = [];

        const searchOptions = this.getSearchOptions();
        const selectedFileInfos = Array.from(this.selectedFiles).map(id => this.currentFiles.get(id));
        
        try {
            for (let i = 0; i < selectedFileInfos.length && this.isSearching; i++) {
                const fileInfo = selectedFileInfos[i];
                
                this.updateProgress(
                    (i / selectedFileInfos.length) * 100,
                    `กำลังประมวลผล: ${fileInfo.name}`
                );
                
                const content = await this.extractFileContent(fileInfo.file);
                
                if (this.isSearching) {
                    const results = this.searchInContent(content, searchQuery, searchOptions, fileInfo.name);
                    
                    results.forEach(result => {
                        this.searchResults.push({
                            fileId: fileInfo.id,
                            fileName: fileInfo.name,
                            pageNumber: result.pageNumber,
                            content: result.content,
                            matches: result.matches,
                            file: fileInfo.file
                        });
                    });
                    
                    this.displaySearchResults();
                    this.updateStatistics();
                }
                
                await new Promise(resolve => setTimeout(resolve, 30));
            }
            
            if (this.isSearching) {
                this.completeSearch();
            }
            
        } catch (error) {
            console.error('Search error:', error);
            alert('เกิดข้อผิดพลาดในการค้นหา');
            this.updateSearchUI(false);
        }
    }

    async extractFileContent(file) {
        const fileType = this.getFileType(file.name);
        
        try {
            switch (fileType) {
                case 'pdf':
                    return await this.parsePDF(file);
                case 'doc':
                    return await this.parseWord(file);
                case 'txt':
                case 'rtf':
                    return await this.parseText(file);
                default:
                    throw new Error(`Unsupported file type: ${fileType}`);
            }
        } catch (error) {
            console.error(`Error extracting content from ${file.name}:`, error);
            return { pages: [{ pageNumber: 1, content: '' }] };
        }
    }

    async parsePDF(file) {
        try {
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pages = [];
            
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                try {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    
                    const pageText = textContent.items
                        .map(item => item.str)
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    pages.push({
                        pageNumber: pageNum,
                        content: pageText
                    });
                } catch (pageError) {
                    console.warn(`Error parsing PDF page ${pageNum}:`, pageError);
                }
            }
            
            return { pages };
        } catch (error) {
            throw new Error(`Failed to parse PDF: ${error.message}`);
        }
    }

    async parseWord(file) {
        try {
            if (typeof mammoth === 'undefined') {
                throw new Error('Mammoth library not loaded');
            }
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const result = await mammoth.extractRawText({ arrayBuffer });
            
            const pages = this.splitIntoPages(result.value, 2000);
            return { pages };
        } catch (error) {
            throw new Error(`Failed to parse Word document: ${error.message}`);
        }
    }

    async parseText(file) {
        try {
            const text = await this.fileToText(file);
            const pages = this.splitIntoPages(text, 3000);
            return { pages };
        } catch (error) {
            throw new Error(`Failed to parse text file: ${error.message}`);
        }
    }

    splitIntoPages(content, charsPerPage = 2000) {
        if (!content || content.trim().length === 0) {
            return [{ pageNumber: 1, content: '' }];
        }

        const pages = [];
        let currentPage = 1;
        let currentPos = 0;
        
        while (currentPos < content.length) {
            let endPos = currentPos + charsPerPage;
            
            if (endPos < content.length) {
                const nextSpace = content.indexOf(' ', endPos);
                const nextNewline = content.indexOf('\n', endPos);
                
                if (nextSpace !== -1 && (nextNewline === -1 || nextSpace < nextNewline)) {
                    endPos = nextSpace;
                } else if (nextNewline !== -1) {
                    endPos = nextNewline;
                }
            }
            
            const pageContent = content.substring(currentPos, endPos).trim();
            
            if (pageContent.length > 0) {
                pages.push({
                    pageNumber: currentPage,
                    content: pageContent
                });
            }
            
            currentPos = endPos + 1;
            currentPage++;
        }
        
        if (pages.length === 0) {
            pages.push({
                pageNumber: 1,
                content: content.trim()
            });
        }
        
        return pages;
    }

    fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    fileToText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file, 'UTF-8');
        });
    }

    searchInContent(documentContent, query, options, fileName) {
        const results = [];
        
        if (!documentContent.pages || !Array.isArray(documentContent.pages)) {
            return results;
        }

        const searchRegex = this.buildSearchRegex(query, options);

        documentContent.pages.forEach(page => {
            const matches = this.findMatches(page.content, searchRegex);
            
            if (matches.length > 0) {
                const contexts = this.extractContexts(page.content, matches);
                
                contexts.forEach(context => {
                    results.push({
                        pageNumber: page.pageNumber,
                        content: context.text,
                        matches: context.matches
                    });
                });
            }
        });

        return results;
    }

    buildSearchRegex(query, options) {
        let pattern = query;
        
        if (!options.useRegex) {
            pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        
        if (options.wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }
        
        const flags = options.caseSensitive ? 'g' : 'gi';
        
        try {
            return new RegExp(pattern, flags);
        } catch (error) {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(escapedQuery, flags);
        }
    }

    findMatches(content, regex) {
        const matches = [];
        let match;
        
        regex.lastIndex = 0;
        
        while ((match = regex.exec(content)) !== null) {
            matches.push({
                index: match.index,
                length: match[0].length,
                text: match[0]
            });
            
            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }
        
        return matches;
    }

    extractContexts(content, matches) {
        const contexts = [];
        const contextRadius = 150;
        
        const groups = this.groupMatches(matches, contextRadius * 2);
        
        groups.forEach(group => {
            const firstMatch = group[0];
            const lastMatch = group[group.length - 1];
            
            const start = Math.max(0, firstMatch.index - contextRadius);
            const end = Math.min(content.length, lastMatch.index + lastMatch.length + contextRadius);
            
            const contextText = content.substring(start, end);
            
            const adjustedMatches = group.map(match => ({
                index: match.index - start,
                length: match.length,
                text: match.text
            }));
            
            contexts.push({
                text: this.cleanContext(contextText),
                matches: adjustedMatches
            });
        });

        return contexts;
    }

    groupMatches(matches, maxDistance) {
        if (matches.length === 0) return [];
        
        const groups = [];
        let currentGroup = [matches[0]];
        
        for (let i = 1; i < matches.length; i++) {
            const currentMatch = matches[i];
            const lastMatch = currentGroup[currentGroup.length - 1];
            
            const distance = currentMatch.index - (lastMatch.index + lastMatch.length);
            
            if (distance <= maxDistance) {
                currentGroup.push(currentMatch);
            } else {
                groups.push(currentGroup);
                currentGroup = [currentMatch];
            }
        }
        
        groups.push(currentGroup);
        return groups;
    }

    cleanContext(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }

    getSearchOptions() {
        return {
            caseSensitive: document.getElementById('caseSensitive')?.checked || false,
            wholeWord: document.getElementById('wholeWord')?.checked || false,
            useRegex: document.getElementById('useRegex')?.checked || false
        };
    }

    updateSearchUI(searching) {
        const searchButton = document.getElementById('searchButton');
        const cancelButton = document.getElementById('cancelButton');
        const searchInput = document.getElementById('searchInput');
        const progressContainer = document.getElementById('progressContainer');
        
        if (searchButton) searchButton.disabled = searching;
        if (searchInput) searchInput.disabled = searching;
        
        if (searching) {
            if (cancelButton) cancelButton.style.display = 'block';
            if (progressContainer) progressContainer.style.display = 'block';
        } else {
            if (cancelButton) cancelButton.style.display = 'none';
            if (progressContainer) progressContainer.style.display = 'none';
        }
    }

    updateProgress(percentage, message = '') {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) progressFill.style.width = percentage + '%';
        if (progressText) progressText.textContent = message || `${Math.round(percentage)}%`;
    }

    displaySearchResults() {
        const resultsContainer = document.getElementById('resultsContainer');
        
        if (!resultsContainer || this.searchResults.length === 0) {
            return;
        }

        let html = '';
        this.searchResults.forEach((result, index) => {
            html += this.createResultHTML(result, index);
        });

        resultsContainer.innerHTML = html;
        this.bindResultEvents();
    }

    createResultHTML(result, index) {
        const highlightedContent = this.highlightSearchTerms(result.content, result.matches);
        
        return `
            <div class="result-item" data-result-index="${index}">
                <div class="result-header" onclick="app.viewDocument(${index})">
                    <div class="file-name-result">📄 ${result.fileName}</div>
                    <div>
                        <span class="page-number">หน้า ${result.pageNumber}</span>
                        <button class="new-tab-btn" onclick="event.stopPropagation(); app.openFileInNewTab(${index})">
                            🔗 New Tab
                        </button>
                    </div>
                </div>
                <div class="page-content">${highlightedContent}</div>
            </div>
        `;
    }

    highlightSearchTerms(content, matches) {
        if (!matches || matches.length === 0) {
            return content;
        }

        let highlightedContent = content;
        const sortedMatches = matches.sort((a, b) => b.index - a.index);
        
        sortedMatches.forEach(match => {
            const beforeMatch = highlightedContent.substring(0, match.index);
            const matchText = highlightedContent.substring(match.index, match.index + match.length);
            const afterMatch = highlightedContent.substring(match.index + match.length);
            
            highlightedContent = beforeMatch + `<span class="highlight">${matchText}</span>` + afterMatch;
        });

        return highlightedContent;
    }

    bindResultEvents() {
        // Results are bound in createResultHTML via onclick
    }

    viewDocument(resultIndex) {
        const result = this.searchResults[resultIndex];
        if (!result) return;

        this.currentViewedFile = result.file;
        this.currentViewedPage = result.pageNumber;
        this.showDocumentContent(result);
    }

    openFileInNewTab(resultIndex) {
        const result = this.searchResults[resultIndex];
        if (!result || !result.file) return;

        const fileURL = URL.createObjectURL(result.file);
        
        let finalURL = fileURL;
        if (this.getFileType(result.file.name) === 'pdf') {
            finalURL = `${fileURL}#page=${result.pageNumber}`;
        }
        
        const newWindow = window.open(finalURL, '_blank');
        
        if (newWindow) {
            newWindow.focus();
            setTimeout(() => {
                URL.revokeObjectURL(fileURL);
            }, 2000);
        } else {
            alert('กรุณาอนุญาตให้เปิดหน้าต่างใหม่ในเบราว์เซอร์');
        }
    }

    showDocumentContent(result) {
        const documentViewer = document.getElementById('documentViewer');
        
        if (!documentViewer) return;

        documentViewer.innerHTML = `
            <div class="document-content-viewer" style="height: 100%; overflow-y: auto; padding: 15px; background: white;">
                <div style="border-bottom: 2px solid #3498db; padding-bottom: 12px; margin-bottom: 15px;">
                    <h4 style="color: #2c3e50; margin-bottom: 5px; font-size: 0.9rem;">📄 ${result.fileName}</h4>
                    <p style="color: #7f8c8d; font-size: 0.8rem;">หน้า ${result.pageNumber}</p>
                    <button onclick="app.closeDocumentViewer()" style="float: right; background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 0.8rem;">❌ ปิด</button>
                    <button onclick="app.openFileInNewTab(${this.searchResults.indexOf(result)})" style="float: right; background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; margin-right: 6px; font-size: 0.8rem;">🔗 New Tab</button>
                </div>
                <div style="line-height: 1.6; color: #2c3e50; font-size: 0.85rem;">
                    ${this.highlightSearchTerms(result.content, result.matches)}
                </div>
            </div>
        `;
    }

    closeDocumentViewer() {
        const documentViewer = document.getElementById('documentViewer');
        if (!documentViewer) return;

        documentViewer.innerHTML = `
            <div class="viewer-placeholder">
                <div class="placeholder-icon">👁️</div>
                <h4>ตัวอย่างเอกสาร</h4>
                <p>คลิกที่ผลการค้นหาเพื่อดูตัวอย่างเอกสาร</p>
                <div class="viewer-features">
                    <div class="viewer-feature">
                        <span class="feature-bullet">•</span>
                        <span>แสดงตัวอย่าง PDF แบบเต็มรูปแบบ</span>
                    </div>
                    <div class="viewer-feature">
                        <span class="feature-bullet">•</span>
                        <span>ซูมและเลื่อนดูเอกสารได้</span>
                    </div>
                    <div class="viewer-feature">
                        <span class="feature-bullet">•</span>
                        <span>เปิดในแท็บใหม่ได้</span>
                    </div>
                </div>
            </div>
        `;
    }

    completeSearch() {
        this.isSearching = false;
        this.updateSearchUI(false);
        this.updateProgress(100, 'การค้นหาเสร็จสิ้น');
        
        if (this.searchResults.length === 0) {
            this.showNoResults();
        } else {
            this.showExportControls(true);
            alert(`พบผลการค้นหา ${this.searchResults.length} รายการ`);
        }
    }

    cancelSearch() {
        this.isSearching = false;
        this.updateSearchUI(false);
        alert('ยกเลิกการค้นหาแล้ว');
    }

    showNoResults() {
        const resultsContainer = document.getElementById('resultsContainer');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="no-results">
                <h3>🔍 ไม่พบผลการค้นหา</h3>
                <p>ลองเปลี่ยนคำค้นหาหรือตัวเลือกการค้นหา</p>
            </div>
        `;
    }

    clearResults() {
        const resultsContainer = document.getElementById('resultsContainer');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">📚</div>
                <h3>ยินดีต้อนรับสู่ระบบค้นหาเอกสารองค์กร</h3>
                <p>เลือกไฟล์เอกสารหรือโฟลเดอร์และเริ่มค้นหาข้อมูลที่ต้องการ</p>
                <div class="info-box">
                    <h4>🔍 วิธีการใช้งาน</h4>
                    <ol class="usage-steps">
                        <li>เลือกไฟล์หรือโฟลเดอร์ที่ต้องการค้นหา</li>
                        <li>ใส่คำค้นหาในช่องค้นหา</li>
                        <li>กำหนดตัวเลือกการค้นหาตามต้องการ</li>
                        <li>คลิก "เริ่มค้นหา" เพื่อเริ่มการค้นหา</li>
                        <li>คลิกที่ผลลัพธ์เพื่อดูตัวอย่างเอกสาร</li>
                    </ol>
                </div>
                <div class="features-grid">
                    <div class="feature-card">
                        <div class="feature-icon">📄</div>
                        <h4>รองรับหลายรูปแบบ</h4>
                        <p>PDF, DOC, DOCX, TXT, RTF</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">⚡</div>
                        <h4>ค้นหาเร็ว</h4>
                        <p>ประมวลผลหลายไฟล์พร้อมกัน</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">📊</div>
                        <h4>ส่งออกผลลัพธ์</h4>
                        <p>CSV, JSON, PDF Report</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">🔒</div>
                        <h4>ปลอดภัย</h4>
                        <p>ประมวลผลในเครื่องของคุณ</p>
                    </div>
                </div>
            </div>
        `;
    }

    updateStatistics() {
        const totalFilesCount = document.getElementById('totalFilesCount');
        const selectedFilesCount = document.getElementById('selectedFilesCount');
        const searchResultsCount = document.getElementById('searchResultsCount');
        const filesWithMatchesCount = document.getElementById('filesWithMatchesCount');

        if (totalFilesCount) totalFilesCount.textContent = this.currentFiles.size;
        if (selectedFilesCount) selectedFilesCount.textContent = this.selectedFiles.size;
        if (searchResultsCount) searchResultsCount.textContent = this.searchResults.length;
        
        const filesWithMatches = new Set(this.searchResults.map(result => result.fileId)).size;
        if (filesWithMatchesCount) filesWithMatchesCount.textContent = filesWithMatches;
    }

    showExportControls(show) {
        const exportControls = document.getElementById('exportControls');
        if (exportControls) {
            exportControls.style.display = show ? 'flex' : 'none';
        }
    }

    exportResults(format) {
        if (this.searchResults.length === 0) {
            alert('ไม่มีผลการค้นหาที่จะส่งออก');
            return;
        }

        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `search-results-${timestamp}`;

        try {
            switch (format) {
                case 'csv':
                    this.exportToCSV(filename);
                    break;
                case 'json':
                    this.exportToJSON(filename);
                    break;
                case 'pdf':
                    this.exportToPDF(filename);
                    break;
            }
            alert(`ส่งออกผลการค้นหาเป็น ${format.toUpperCase()} เรียบร้อยแล้ว`);
        } catch (error) {
            console.error('Export error:', error);
            alert('เกิดข้อผิดพลาดในการส่งออก');
        }
    }

    exportToCSV(filename) {
        const searchInput = document.getElementById('searchInput');
        const headers = ['ชื่อไฟล์', 'หน้า', 'เนื้อหา', 'จำนวนที่พบ'];
        const rows = this.searchResults.map(result => [
            result.fileName,
            result.pageNumber,
            result.content.replace(/\n/g, ' ').substring(0, 500),
            result.matches.length
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        this.downloadFile('\uFEFF' + csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
    }

    exportToJSON(filename) {
        const searchInput = document.getElementById('searchInput');
        const exportData = {
            searchQuery: searchInput ? searchInput.value : '',
            searchDate: new Date().toISOString(),
            totalResults: this.searchResults.length,
            results: this.searchResults.map(result => ({
                fileName: result.fileName,
                pageNumber: result.pageNumber,
                content: result.content,
                matchCount: result.matches.length
            }))
        };

        this.downloadFile(JSON.stringify(exportData, null, 2), `${filename}.json`, 'application/json');
    }

    exportToPDF(filename) {
        const searchInput = document.getElementById('searchInput');
        const printWindow = window.open('', '_blank');
        const searchQuery = searchInput ? searchInput.value : '';
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Search Results Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                    .result { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; }
                    .result-header { font-weight: bold; color: #333; }
                    .result-content { margin-top: 10px; line-height: 1.6; }
                    .highlight { background-color: yellow; padding: 2px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Search Results Report</h1>
                    <p><strong>Search Query:</strong> ${searchQuery}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleString('th-TH')}</p>
                    <p><strong>Total Results:</strong> ${this.searchResults.length}</p>
                </div>
                ${this.searchResults.map((result, index) => `
                    <div class="result">
                        <div class="result-header">${result.fileName} - หน้า ${result.pageNumber}</div>
                        <div class="result-content">${this.highlightSearchTerms(result.content, result.matches)}</div>
                    </div>
                `).join('')}
            </body>
            </html>
        `;
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the application
let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new DocumentSearchApp();
    window.app = app; // Make globally accessible
});
