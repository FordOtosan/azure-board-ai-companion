import { Close as CloseIcon } from '@mui/icons-material';
import {
    Alert,
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Typography
} from '@mui/material';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist';
import * as React from 'react';
import { Language } from '../../../translations';

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
  const PDFJS_VERSION = pdfjsLib.version;
  const workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

// Define translations for this component
const translations = {
  en: {
    title: 'Upload File',
    dragDropText: 'Drag and drop a file here, or click to select',
    supportedFormats: 'Supported formats: PDF, DOCX',
    maxSize: 'Maximum file size: 5MB',
    uploadError: 'Error uploading file',
    invalidType: 'Invalid file type. Please upload PDF or DOCX files only.',
    fileTooLarge: 'File is too large. Maximum size is 5MB.',
    close: 'Close',
    characterCount: 'Character count:',
    processing: 'Processing file...',
    duplicateFile: 'This file has already been uploaded.',
    uploadedFiles: 'Uploaded Files'
  },
  tr: {
    title: 'Dosya Yükle',
    dragDropText: 'Dosyayı buraya sürükleyin veya seçmek için tıklayın',
    supportedFormats: 'Desteklenen formatlar: PDF, DOCX',
    maxSize: 'Maksimum dosya boyutu: 5MB',
    uploadError: 'Dosya yükleme hatası',
    invalidType: 'Geçersiz dosya türü. Lütfen sadece PDF veya DOCX dosyaları yükleyin.',
    fileTooLarge: 'Dosya çok büyük. Maksimum boyut 5MB.',
    close: 'Kapat',
    characterCount: 'Karakter sayısı:',
    processing: 'Dosya işleniyor...',
    duplicateFile: 'Bu dosya zaten yüklenmiş.',
    uploadedFiles: 'Yüklenen Dosyalar'
  }
} as const;

interface FileUploadModalProps {
  open: boolean;
  onClose: () => void;
  currentLanguage: Language;
  onFileProcessed: (content: string, fileName: string) => void;
  uploadedFiles: { name: string; content: string }[];
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  open,
  onClose,
  currentLanguage,
  onFileProcessed,
  uploadedFiles
}) => {
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [characterCount, setCharacterCount] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const T = translations[currentLanguage];

  const validateFile = (file: File): boolean => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setError(T.invalidType);
      return false;
    }
    
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setError(T.fileTooLarge);
      return false;
    }

    // Check for duplicate file
    if (uploadedFiles.some(f => f.name === file.name)) {
      setError(T.duplicateFile);
      return false;
    }
    
    return true;
  };

  const processFile = async (file: File) => {
    setProcessing(true);
    setError(null);
    setCharacterCount(null);

    try {
      const text = await readFileContent(file);
      setCharacterCount(text.length);
      onFileProcessed(text, file.name);
      onClose();
    } catch (err) {
      setError(T.uploadError);
      console.error('Error processing file:', err);
    } finally {
      setProcessing(false);
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      if (file.type === 'application/pdf') {
        reader.onload = async (e) => {
          try {
            const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
            const loadingTask = pdfjsLib.getDocument({ data: typedArray });
            
            let pdf: PDFDocumentProxy;
            try {
              pdf = await loadingTask.promise;
            } catch (error) {
              console.error('Error loading PDF:', error);
              reject(error);
              return;
            }
              
            let fullText = '';
            try {
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((item: any) => item.str || '')
                  .join(' ');
                fullText += pageText + '\n';
              }
              resolve(fullText.trim());
            } catch (error) {
              console.error('Error extracting text from PDF:', error);
              reject(error);
            } finally {
              pdf.destroy();
            }
          } catch (error) {
            console.error('PDF processing error:', error);
            reject(error);
          }
        };
        reader.onerror = () => {
          console.error('FileReader error:', reader.error);
          reject(reader.error);
        };
        reader.readAsArrayBuffer(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            resolve(result.value.trim());
          } catch (error) {
            console.error('DOCX processing error:', error);
            reject(error);
          }
        };
        reader.onerror = () => {
          console.error('FileReader error:', reader.error);
          reject(reader.error);
        };
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file type'));
      }
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
      await processFile(file);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      await processFile(file);
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {T.title}
        <IconButton
          aria-label={T.close}
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          sx={{
            border: '2px dashed',
            borderColor: dragActive ? 'primary.main' : 'grey.300',
            borderRadius: 1,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: dragActive ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
          onClick={handleButtonClick}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleChange}
            style={{ display: 'none' }}
          />
          <Typography variant="body1" gutterBottom>
            {T.dragDropText}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {T.supportedFormats}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {T.maxSize}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {processing && (
          <Typography sx={{ mt: 2, textAlign: 'center' }}>
            {T.processing}
          </Typography>
        )}

        {characterCount !== null && (
          <Typography sx={{ mt: 2, textAlign: 'center' }}>
            {T.characterCount} {characterCount.toLocaleString()}
          </Typography>
        )}

        {uploadedFiles.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              {T.uploadedFiles}
            </Typography>
            <List>
              {uploadedFiles.map((file, index) => (
                <ListItem key={index}>
                  <ListItemText primary={file.name} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}; 