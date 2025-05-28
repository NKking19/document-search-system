// Set up PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

class DocumentSearchApp {
    constructor() {
        this.currentFiles = new Map();
        this.selectedFiles = new Set();
        this.searchResults = [];
        this.isSearching = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateStatistics();
        console.log('Document Search initialized');
    }

    bindEvents() {
        // File selection mode buttons
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

        // File inputs
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

        // File management buttons
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

        // Search button
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
        
        alert(`เพิ่มไฟล์ ${supportedFiles.length} ไฟล์เรียบร้อยแล้ว`);
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
        return file.name + '_' + file.size + '_' + file.lastModified;
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

    // ฟังก์ชันค้นหาที่สมบูรณ์
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
        this.searchResults = [];
        this.clearResults();

        const selectedFileInfos = Array.from(this.selectedFiles).map(id => this.currentFiles.get(id));
        
        try {
            for (let i = 0; i < selectedFileInfos.length && this.isSearching; i++) {
                const fileInfo = selectedFileInfos[i];
                
                this.updateProgress(
                    (i / selectedFileInfos.length) * 100,
                    `กำลังค้นหาใน: ${fileInfo.name}`
                );
                
                const content = await this.extractFileContent(fileInfo.file);
                
                if (this.isSearching && content) {
                    const results = this.searchInContent(content, searchQuery, fileInfo.name);
                    
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
                }
                
                // อัปเดต UI ทุก 5 ไฟล์
                if (i % 5 === 0) {
                    this.displaySearchResults();
                    this.updateStatistics();
                }
                
                await new Promise(resolve => setTimeout(resolve, 10));
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

    cancelSearch() {
        this.isSearching = false;
        this.updateSearchUI(false);
        alert('ยกเลิกการค้นหาแล้ว');
    }

    async extractFileContent(file) {
        const fileType = this.getFileType(file.name);
        
        try {
            switch (fileType) {
                case 'pdf':
                    return await this.parsePDF(file);
                case 'txt':
                    return await this.parseText(file);
                default:
                    return await this.parseText(file); // fallback
            }
        } catch (error) {
            console.error(`Error extracting content from ${file.name}:`, error);
            return null;
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
            console.error('PDF parsing error:', error);
            return null;
        }
    }

    async parseText(file) {
        try {
            const text = await this.fileToText(file);
            return {
                pages: [{
                    pageNumber: 1,
                    content: text
                }]
            };
        } catch (error) {
            console.error('Text parsing error:', error);
            return null;
        }
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

    searchInContent(documentContent, query, fileName) {
        const results = [];
        
        if (!documentContent || !documentContent.pages) {
            return results;
        }

        const searchOptions = this.getSearchOptions();
        const searchRegex = this.buildSearchRegex(query, searchOptions);

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
        const contextRadius = 100;
        
        matches.forEach(match => {
            const start = Math.max(0, match.index - contextRadius);
            const end = Math.min(content.length, match.index + match.length + contextRadius);
            
            const contextText = content.substring(start, end);
            
            contexts.push({
                text: contextText.trim(),
                matches: [{
                    index: match.index - start,
                    length: match.length,
                    text: match.text
                }]
            });
        });

        return contexts;
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
        const progressContainer = document.getElementById('progressContainer');
        
        if (searchButton) searchButton.disabled = searching;
        
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
        
        if (!resultsContainer) return;

        if (this.searchResults.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <h3>🔍 ไม่พบผลการค้นหา</h3>
                    <p>ลองเปลี่ยนคำค้นหาหรือตัวเลือกการค้นหา</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.searchResults.forEach((result, index) => {
            const highlightedContent = this.highlightSearchTerms(result.content, result.matches);
            
            html += `
                <div class="result-item">
                    <div class="result-header">
                        <div class="file-name-result">📄 ${result.fileName}</div>
                        <div>
                            <span class="page-number">หน้า ${result.pageNumber}</span>
                        </div>
                    </div>
                    <div class="page-content">${highlightedContent}</div>
                </div>
            `;
        });

        resultsContainer.innerHTML = html;
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

    completeSearch() {
        this.isSearching = false;
        this.updateSearchUI(false);
        this.updateProgress(100, 'การค้นหาเสร็จสิ้น');
        
        this.displaySearchResults();
        this.updateStatistics();
        
        if (this.searchResults.length === 0) {
            alert('ไม่พบผลการค้นหา');
        } else {
            alert(`พบผลการค้นหา ${this.searchResults.length} รายการ`);
        }
    }

    clearResults() {
        const resultsContainer = document.getElementById('resultsContainer');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">📚</div>
                <h3>ยินดีต้อนรับสู่ระบบค้นหาเอกสารองค์กร</h3>
                <p>เลือกไฟล์เอกสารหรือโฟลเดอร์และเริ่มค้นหาข้อมูลที่ต้องการ</p>
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
    window.app = app;
});
