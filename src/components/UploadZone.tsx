import React, { useState, useRef } from 'react';
import { Upload, Image, FileText, FileCode, CheckCircle2 } from 'lucide-react';
import { determineFileCategory } from '../utils';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export default function UploadZone({ onFilesSelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSuccessFeedback, setUploadSuccessFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    const filesArray = Array.from(fileList);
    onFilesSelected(filesArray);
    
    // Show success visual feedback
    setUploadSuccessFeedback(true);
    setTimeout(() => {
      setUploadSuccessFeedback(false);
    }, 2000);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const triggerFileBrowser = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      id="upload-dropzone-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer overflow-hidden group
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01] shadow-md shadow-indigo-100 dark:shadow-none' 
          : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-900/10'
        }
      `}
      onClick={triggerFileBrowser}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        id="file-upload-input"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Decorative background visual elements */}
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
        <Image className="w-24 h-24" />
      </div>
      <div className="absolute bottom-0 left-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
        <FileText className="w-24 h-24" />
      </div>

      <div className="flex flex-col items-center justify-center space-y-4 py-4">
        {uploadSuccessFeedback ? (
          <div className="flex flex-col items-center space-y-2 animate-bounce">
            <div className="p-3.5 bg-emerald-100 dark:bg-emerald-950/40 rounded-full text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              ¡Archivos cargados!
            </p>
          </div>
        ) : (
          <>
            <div className={`p-4 rounded-2xl transition-all duration-300 
              ${isDragging 
                ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 scale-110' 
                : 'bg-slate-150 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:scale-[1.05] group-hover:bg-indigo-50 group-hover:text-indigo-500 dark:group-hover:bg-indigo-950/20'
              }`}
            >
              <Upload className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5 max-w-sm">
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                Arrastra tus archivos y fotos aquí
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                o haz <span className="text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline">clic para explorar</span> en tu equipo
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-400 dark:text-slate-500 pt-2">
              <div className="flex items-center space-x-1">
                <Image className="w-3.5 h-3.5" />
                <span>Imágenes (JPEG, PNG, GIF, WebP)</span>
              </div>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Documentos (PDF, TXT, CSV, etc.)</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
