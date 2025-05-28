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
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                this.startSearch();
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

        alert(`เริ่มค้นหาคำว่า "${searchQuery}" ในไฟล์ ${this.selectedFiles.size} ไฟล์`);
    }

    updateStatistics() {
        const totalFilesCount = document.getElementById('totalFilesCount');
        const selectedFilesCount = document.getElementById('selectedFilesCount');
        const searchResultsCount = document.getElementById('searchResultsCount');
        const filesWithMatchesCount = document.getElementById('filesWithMatchesCount');

        if (totalFilesCount) totalFilesCount.textContent = this.currentFiles.size;
        if (selectedFilesCount) selectedFilesCount.textContent = this.selectedFiles.size;
        if (searchResultsCount) searchResultsCount.textContent = this.searchResults.length;
        if (filesWithMatchesCount) filesWithMatchesCount.textContent = 0;
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
