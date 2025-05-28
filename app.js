// Set up PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * Document Search Professional - Main Application
 * ระบบค้นหาเอกสารขั้นสูงสำหรับองค์กร
 */
class DocumentSearchApp {
    constructor() {
        this.searchManager = null;
        this.pdfViewer = null;
        this.statisticsPanel = null;
        this.storageManager = new StorageManager();
        this.documentParsers = new DocumentParsers();
        
        this.currentFiles = new Map();
        this.selectedFiles = new Set();
        this.searchResults = [];
        this.isSearching = false;
        this.searchWorker = null;
        
        this.init();
    }

    async init() {
        try {
            this.initializeComponents();
            this.bindEvents();
            this.loadStoredData();
            
            console.log('Enhanced Document Search Application initialized successfully');
        } catch (error) {
            console.error('Error initializing application:', error);
            this.showError('เกิดข้อผิดพลาดในการเริ่มต้นโปรแกรม');
        }
    }

    initializeComponents() {
        // Initialize core components
        this.searchManager = new SearchManager(this);
        this.pdfViewer = new PDFViewer(this);
        this.statisticsPanel = new StatisticsPanel(this);
        
        // Initialize search worker
        this.initSearchWorker();
    }

    initSearchWorker() {
        try {
            this.searchWorker = new Worker('workers/document-processor.js');
            this.searchWorker.onmessage = (event) => {
                this.handleWorkerMessage(event.data);
            };
            this.searchWorker.onerror = (error) => {
                console.error('Search worker error:', error);
                this.showError('เกิดข้อผิดพลาดในการประมวลผล');
            };
        } catch (error) {
            console.error('Failed to initialize search worker:', error);
        }
    }

    bindEvents() {
        // File selection events
        this.bindFileSelectionEvents();
        
        // Search events
        this.bindSearchEvents();
        
        // UI events
        this.bindUIEvents();
        
        // Export events
        this.bindExportEvents();
    }

    bindFileSelectionEvents() {
        const fileInput = document.getElementById('fileInput');
        const folderInput = document.getElementById('folderInput');
        const optionButtons = document.querySelectorAll('.option-button');
        const selectAllBtn = document.getElementById('selectAllBtn');
        const clearFilesBtn = document.getElementById('clearFilesBtn');

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        folderInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Option buttons
        optionButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.handleOptionChange(button.dataset.option);
            });
        });

        // File management buttons
        selectAllBtn.addEventListener('click', () => {
            this.selectAllFiles();
        });

        clearFilesBtn.addEventListener('click', () => {
            this.clearAllFiles();
        });
    }

    bindSearchEvents() {
        const searchButton = document.getElementById('searchButton');
        const cancelButton = document.getElementById('cancelButton');
        const searchInput = document.getElementById('searchInput');

        searchButton.addEventListener('click', () => {
            this.startSearch();
        });

        cancelButton.addEventListener('click', () => {
            this.cancelSearch();
        });

        // Search on Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.startSearch();
            }
        });
    }

    bindUIEvents() {
        // File type filter changes
        const filterCheckboxes = document.querySelectorAll('[id$="-filter"]');
        filterCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateFileTypeFilter();
            });
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    bindExportEvents() {
        const exportCsvBtn = document.getElementById('exportCsv');
        const exportJsonBtn = document.getElementById('exportJson');
        const exportPdfBtn = document.getElementById('exportPdf');

        exportCsvBtn.addEventListener('click', () => {
            this.exportResults('csv');
        });

        exportJsonBtn.addEventListener('click', () => {
            this.exportResults('json');
        });

        exportPdfBtn.addEventListener('click', () => {
            this.exportResults('pdf');
        });
    }

    async handleFileSelection(files) {
        const fileArray = Array.from(files);
        const supportedFiles = this.filterSupportedFiles(fileArray);
        
        if (supportedFiles.length === 0) {
            this.showError('ไม่พบไฟล์ที่รองรับ กรุณาเลือกไฟล์ PDF, DOC, DOCX, TXT หรือ RTF');
            return;
        }

        try {
            this.showProgress(true, 'กำลังโหลดไฟล์...');
            
            for (let i = 0; i < supportedFiles.length; i++) {
                const file = supportedFiles[i];
                await this.addFileToList(file);
                
                const progress = ((i + 1) / supportedFiles.length) * 100;
                this.updateProgress(progress, `โหลดไฟล์ ${i + 1}/${supportedFiles.length}`);
            }
            
            this.updateFileList();
            this.updateStatistics();
            
        } catch (error) {
            console.error('Error handling file selection:', error);
            this.showError('เกิดข้อผิดพลาดในการโหลดไฟล์');
        } finally {
            this.showProgress(false);
        }
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
            return; // File already exists
        }

        const fileInfo = {
            id: fileId,
            file: file,
            name: file.name,
            size: file.size,
            type: this.getFileType(file.name),
            lastModified: file.lastModified,
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
        
        if (this.currentFiles.size === 0) {
            fileList.innerHTML = `
                <div class="no-files">
                    <i data-feather="file-text" class="no-files-icon"></i>
                    <p>ยังไม่มีไฟล์ที่เลือก</p>
                </div>
            `;
            feather.replace();
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
                        <div class="file-details">${fileSize}</div>
                    </div>
                    <span class="file-type-badge ${fileInfo.type}">${fileInfo.type.toUpperCase()}</span>
                </div>
            `;
        });

        fileList.innerHTML = html;
        
        // Bind file item events
        this.bindFileItemEvents();
        feather.replace();
    }

    bindFileItemEvents() {
        const fileItems = document.querySelectorAll('.file-item');
        
        fileItems.forEach(item => {
            const checkbox = item.querySelector('.file-checkbox');
            const fileId = item.dataset.fileId;
            
            // Checkbox change
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleFileSelection(fileId, checkbox.checked);
            });
            
            // Item click
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
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

    handleOptionChange(option) {
        const optionButtons = document.querySelectorAll('.option-button');
        const fileInput = document.getElementById('fileInput');
        const folderInput = document.getElementById('folderInput');
        const fileInputLabel = document.getElementById('fileInputLabel');

        optionButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-option="${option}"]`).classList.add('active');

        if (option === 'files') {
            fileInput.style.display = 'block';
            folderInput.style.display = 'none';
            fileInputLabel.setAttribute('for', 'fileInput');
            fileInputLabel.innerHTML = '<i data-feather="upload"></i> เลือกไฟล์เอกสาร';
        } else {
            fileInput.style.display = 'none';
            folderInput.style.display = 'block';
            fileInputLabel.setAttribute('for', 'folderInput');
            fileInputLabel.innerHTML = '<i data-feather="folder"></i> เลือกโฟลเดอร์';
        }
        
        feather.replace();
    }

    async startSearch() {
        const searchQuery = document.getElementById('searchInput').value.trim();
        
        if (!searchQuery) {
            this.showError('กรุณาใส่คำที่ต้องการค้นหา');
            return;
        }

        if (this.selectedFiles.size === 0) {
            this.showError('กรุณาเลือกไฟล์ที่ต้องการค้นหา');
            return;
        }

        // Use the search manager to handle the search
        if (this.searchManager) {
            await this.searchManager.startSearch(searchQuery, this.getSearchOptions(), this.selectedFiles);
        }
    }

    async extractFileContent(file) {
        try {
            const fileType = this.getFileType(file.name);
            
            switch (fileType) {
                case 'pdf':
                    return await this.documentParsers.parsePDF(file);
                case 'doc':
                    return await this.documentParsers.parseWord(file);
                case 'txt':
                    return await this.documentParsers.parseText(file);
                case 'rtf':
                    return await this.documentParsers.parseRTF(file);
                default:
                    throw new Error(`Unsupported file type: ${fileType}`);
            }
        } catch (error) {
            console.error(`Error extracting content from ${file.name}:`, error);
            return { pages: [{ pageNumber: 1, content: '' }] };
        }
    }

    handleWorkerMessage(data) {
        switch (data.type) {
            case 'searchResult':
                this.addSearchResult(data.result);
                break;
            case 'searchComplete':
                this.handleSearchComplete();
                break;
            case 'error':
                console.error('Worker error:', data.error);
                this.showError('เกิดข้อผิดพลาดในการค้นหา');
                this.updateSearchUI(false);
                break;
        }
    }

    addSearchResult(result) {
        this.searchResults.push(result);
        this.displaySearchResults();
        this.updateStatistics();
    }

    handleSearchComplete() {
        this.updateSearchUI(false);
        this.updateStatistics();
        
        if (this.searchResults.length === 0) {
            this.showNoResults();
        } else {
            this.showExportControls(true);
        }
    }

    cancelSearch() {
        if (this.searchManager) {
            this.searchManager.cancelSearch();
        }
        
        this.isSearching = false;
        this.updateSearchUI(false);
        this.showProgress(false);
    }

    getSearchOptions() {
        return {
            caseSensitive: document.getElementById('caseSensitive').checked,
            wholeWord: document.getElementById('wholeWord').checked,
            useRegex: document.getElementById('useRegex').checked
        };
    }

    updateSearchUI(searching) {
        const searchButton = document.getElementById('searchButton');
        const cancelButton = document.getElementById('cancelButton');
        const searchInput = document.getElementById('searchInput');
        
        searchButton.disabled = searching;
        searchInput.disabled = searching;
        
        if (searching) {
            cancelButton.style.display = 'flex';
            this.showProgress(true, 'กำลังค้นหา...');
        } else {
            cancelButton.style.display = 'none';
            this.showProgress(false);
        }
    }

    displaySearchResults() {
        const resultsContainer = document.getElementById('resultsContainer');
        
        if (this.searchResults.length === 0) {
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
                    <div class="file-name-result">
                        <i data-feather="file-text"></i>
                        ${result.fileName}
                    </div>
                    <div class="page-number">หน้า ${result.pageNumber}</div>
                </div>
                <div class="page-content">
                    ${highlightedContent}
                </div>
            </div>
        `;
    }

    highlightSearchTerms(content, matches) {
        if (!matches || matches.length === 0) {
            return content;
        }

        let highlightedContent = content;
        
        // Sort matches by index in descending order to avoid position shifts
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
        feather.replace();
    }

    async viewDocument(resultIndex) {
        const result = this.searchResults[resultIndex];
        if (!result) return;

        const fileInfo = this.currentFiles.get(result.fileId);
        if (!fileInfo) return;

        try {
            if (fileInfo.type === 'pdf') {
                await this.pdfViewer.loadPDF(fileInfo.file, result.pageNumber);
            } else {
                this.showDocumentContent(result);
            }
        } catch (error) {
            console.error('Error viewing document:', error);
            this.showError('เกิดข้อผิดพลาดในการแสดงเอกสาร');
        }
    }

    showDocumentContent(result) {
        const documentViewer = document.getElementById('documentViewer');
        
        documentViewer.innerHTML = `
            <div class="document-content-viewer">
                <div class="document-header">
                    <h4>${result.fileName} - หน้า ${result.pageNumber}</h4>
                    <button class="close-btn" onclick="app.closeDocumentViewer()">
                        <i data-feather="x"></i>
                    </button>
                </div>
                <div class="document-text">
                    ${this.highlightSearchTerms(result.content, result.matches)}
                </div>
            </div>
        `;
        
        feather.replace();
    }

    closeDocumentViewer() {
        const documentViewer = document.getElementById('documentViewer');
        documentViewer.innerHTML = `
            <div class="viewer-placeholder">
                <div class="placeholder-icon">
                    <i data-feather="eye"></i>
                </div>
                <h4>ตัวอย่างเอกสาร</h4>
                <p>คลิกที่ผลการค้นหาเพื่อดูตัวอย่างเอกสาร</p>
            </div>
        `;
        feather.replace();
    }

    showNoResults() {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">
                    <i data-feather="search"></i>
                </div>
                <h3>ไม่พบผลการค้นหา</h3>
                <p>ลองเปลี่ยนคำค้นหาหรือตัวเลือกการค้นหา</p>
            </div>
        `;
        feather.replace();
    }

    clearResults() {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i data-feather="file-text"></i>
                </div>
                <h3>ยินดีต้อนรับสู่ Enhanced Document Search</h3>
                <p>เลือกไฟล์เอกสารและเริ่มค้นหาข้อมูลที่ต้องการ</p>
                <ul class="feature-list">
                    <li><i data-feather="check"></i> รองรับ PDF, DOC, DOCX, TXT, RTF</li>
                    <li><i data-feather="check"></i> ค้นหาแบบขั้นสูงด้วย Regular Expression</li>
                    <li><i data-feather="check"></i> ส่งออกผลการค้นหา</li>
                    <li><i data-feather="check"></i> จัดการประวัติการค้นหา</li>
                </ul>
            </div>
        `;
        feather.replace();
    }

    updateStatistics() {
        if (this.statisticsPanel) {
            this.statisticsPanel.updateStats({
                totalFiles: this.currentFiles.size,
                selectedFiles: this.selectedFiles.size,
                searchResults: this.searchResults.length,
                isSearching: this.isSearching
            });
        }
    }

    showExportControls(show) {
        const exportControls = document.getElementById('exportControls');
        exportControls.style.display = show ? 'flex' : 'none';
    }

    async exportResults(format) {
        if (this.searchResults.length === 0) {
            this.showError('ไม่มีผลการค้นหาที่จะส่งออก');
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
            this.showSuccess(`ส่งออกผลการค้นหาเป็น ${format.toUpperCase()} เรียบร้อยแล้ว`);
        } catch (error) {
            console.error('Export error:', error);
            this.showError('เกิดข้อผิดพลาดในการส่งออก');
        }
    }

    exportToCSV(filename) {
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

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportToJSON(filename) {
        const exportData = {
            searchQuery: document.getElementById('searchInput').value,
            searchDate: new Date().toISOString(),
            totalResults: this.searchResults.length,
            results: this.searchResults
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportToPDF(filename) {
        // Create a simple PDF report using HTML and print functionality
        const printWindow = window.open('', '_blank');
        const searchQuery = document.getElementById('searchInput').value;
        
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

    updateSearchHistory() {
        const historyContainer = document.getElementById('searchHistory');
        const history = this.storageManager.getSearchHistory();
        
        if (history.length === 0) {
            historyContainer.innerHTML = `
                <div class="no-history">
                    <p>ยังไม่มีประวัติการค้นหา</p>
                </div>
            `;
            return;
        }

        let html = '';
        history.slice(0, 10).forEach((item, index) => {
            html += `
                <div class="history-item" onclick="app.useSearchHistory(${index})">
                    <div class="history-query">${item.query}</div>
                    <div class="history-meta">${new Date(item.timestamp).toLocaleString('th-TH')}</div>
                </div>
            `;
        });

        historyContainer.innerHTML = html;
    }

    useSearchHistory(index) {
        const history = this.storageManager.getSearchHistory();
        const item = history[index];
        
        if (item) {
            document.getElementById('searchInput').value = item.query;
            
            // Apply search options
            if (item.options) {
                document.getElementById('caseSensitive').checked = item.options.caseSensitive || false;
                document.getElementById('wholeWord').checked = item.options.wholeWord || false;
                document.getElementById('useRegex').checked = item.options.useRegex || false;
            }
        }
    }

    loadStoredData() {
        try {
            // Load search history
            this.updateSearchHistory();
            
            // Load and apply preferences
            const preferences = this.storageManager.getPreferences();
            if (preferences.defaultSearchOptions) {
                const options = preferences.defaultSearchOptions;
                document.getElementById('caseSensitive').checked = options.caseSensitive || false;
                document.getElementById('wholeWord').checked = options.wholeWord || false;
                document.getElementById('useRegex').checked = options.useRegex || false;
            }
        } catch (error) {
            console.error('Error loading stored data:', error);
        }
    }

    showProgress(show, message = '') {
        const progressContainer = document.querySelector('.progress-container');
        const progressText = document.getElementById('progressText');
        
        if (show) {
            progressContainer.style.display = 'block';
            if (message) {
                progressText.textContent = message;
            }
        } else {
            progressContainer.style.display = 'none';
        }
    }

    updateProgress(percentage, message = '') {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            progressFill.style.width = percentage + '%';
        }
        
        if (progressText && message) {
            progressText.textContent = message;
        }
    }

    updateFileTypeFilter() {
        // This method can be implemented to filter file list by type
        this.updateFileList();
    }

    handleResize() {
        // Handle window resize events
        if (this.pdfViewer) {
            this.pdfViewer.handleResize();
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper notification system
        alert(message);
    }

    showSuccess(message) {
        // Simple success display - could be enhanced with a proper notification system
        console.log('Success:', message);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DocumentSearchApp();
});