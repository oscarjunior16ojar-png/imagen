import { useState, useEffect } from 'react';
import { X, Download, Tag, Calendar, FileText, HardDrive, Info, Globe, AlertCircle, FileCode } from 'lucide-react';
import { StoredFile } from '../types';
import { formatFileSize, determineFileCategory, isTextFile } from '../utils';

interface PreviewModalProps {
  file: StoredFile | null;
  onClose: () => void;
  onDownload: (file: StoredFile) => void;
}

export default function PreviewModal({ file, onClose, onDownload }: PreviewModalProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');
  const [isLoadingText, setIsLoadingText] = useState(false);

  // Keyboard navigation listener (ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!file) return;

    const category = determineFileCategory(file.type, file.name);

    if (category === 'image') {
      const url = URL.createObjectURL(file.blob);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (isTextFile(file.type, file.name)) {
      setIsLoadingText(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        setTextContent((e.target?.result as string) || '');
        setIsLoadingText(false);
      };
      reader.onerror = () => {
        setTextContent('Error: No se pudo leer el archivo de texto.');
        setIsLoadingText(false);
      };
      // Read at most 100KB of text file for performance safety
      const slicedBlob = file.blob.slice(0, 1024 * 100);
      reader.readAsText(slicedBlob);
    }
  }, [file]);

  if (!file) return null;

  const category = determineFileCategory(file.type, file.name);
  const formatDateFull = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in animate-duration-200">
      {/* Click outside backdrop container */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Modal Box */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col md:flex-row overflow-hidden z-10 border border-slate-100 dark:border-slate-800">
        
        {/* Left Side: Visual Preview Stage (60% width on md screens) */}
        <div className="w-full md:w-3/5 bg-slate-50 dark:bg-slate-950/80 p-6 flex flex-col justify-center items-center relative border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800/60 min-h-[300px] md:h-full">
          {category === 'image' && imageUrl ? (
            <div className="w-full h-full flex items-center justify-center group/preview">
              <img
                src={imageUrl}
                alt={file.name}
                className="max-w-full max-h-full rounded-2xl object-contain shadow-sm select-none"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : isTextFile(file.type, file.name) ? (
            <div className="w-full h-full flex flex-col">
              <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800/60 font-mono">
                <span>LECTOR DE TEXTO LOCAL</span>
                <span>{file.name}</span>
              </div>
              <div className="flex-1 w-full overflow-auto mt-3 bg-slate-900 dark:bg-slate-950 p-4 rounded-xl font-mono text-[12px] leading-relaxed text-slate-300 border border-slate-800">
                {isLoadingText ? (
                  <div className="flex items-center justify-center h-full space-x-2">
                    <span className="animate-ping h-2.5 w-2.5 rounded-full bg-indigo-500 opacity-75"></span>
                    <span>Cargando contenido...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-all select-text">{textContent || 'El archivo de texto está vacío.'}</pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 max-w-sm text-center p-8">
              <div className="p-6 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 dark:text-indigo-400 rounded-3xl shadow-sm">
                {file.name.endsWith('.pdf') ? (
                  <FileText className="w-16 h-16 stroke-[1.5]" />
                ) : (
                  <FileCode className="w-16 h-16 stroke-[1.5]" />
                )}
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                  {file.name}
                </h4>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Tipo: <span className="font-mono text-xs">{file.type || 'desconocido'}</span>
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 rounded px-2.5 py-1.5 inline-block">
                  No hay previsualización automática para este tipo de archivo. Descárgalo para abrirlo.
                </p>
              </div>
            </div>
          )}

          {/* Quick Close Button for mobile */}
          <button
            onClick={onClose}
            className="md:hidden absolute top-4 right-4 p-2 bg-slate-900/10 dark:bg-slate-800/50 hover:bg-slate-900/20 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Right Side: Detailed Details Panel (40% width) */}
        <div className="w-full md:w-2/5 p-6 md:p-8 flex flex-col justify-between h-auto md:h-full overflow-y-auto">
          <div className="space-y-6">
            
            {/* Header Title with Desktop Close */}
            <div className="flex items-start justify-between">
              <div className="space-y-1 pr-6">
                <span className="text-[10px] font-mono tracking-widest text-indigo-600 dark:text-indigo-400 font-bold uppercase">
                  Detalles del Archivo
                </span>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight break-all">
                  {file.name}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="hidden md:block p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description Card */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Descripción</span>
              </span>
              <div className="p-4 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/60 text-sm text-slate-600 dark:text-slate-400 rounded-2xl min-h-[4rem] leading-relaxed">
                {file.description || (
                  <span className="text-slate-400 italic">No se ha añadido ninguna descripción a este archivo.</span>
                )}
              </div>
            </div>

            {/* Tags Pills lists */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Etiquetas u Organizadores</span>
              </span>
              {file.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {file.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-100/30"
                    >
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Sin etiquetas asignadas.</p>
              )}
            </div>

            {/* Tech Details list */}
            <div className="space-y-3 pt-4 border-t border-slate-150 dark:border-slate-800/60">
              <h3 className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider font-mono">
                INFORMACIÓN TÉCNICA
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                    <HardDrive className="w-3 h-3" />
                    <span>Tamaño</span>
                  </span>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatFileSize(file.size)} <span className="text-[10px] text-slate-400 font-normal">({file.size.toLocaleString()} B)</span>
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                    <Globe className="w-3 h-3" />
                    <span>Tipo MIME</span>
                  </span>
                  <p className="font-semibold text-slate-700 dark:text-slate-300 truncate font-mono text-[11px]" title={file.type}>
                    {file.type || 'desconocido'}
                  </p>
                </div>

                <div className="space-y-1 col-span-2">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Fecha de carga</span>
                  </span>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatDateFull(file.createdAt)}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Action buttons footer */}
          <div className="pt-6 border-t border-slate-150 dark:border-slate-800/60 mt-6 flex space-x-3">
            <button
              onClick={() => onDownload(file)}
              className="flex-1 flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-3 px-4 font-semibold text-sm transition-all shadow-md hover:shadow-indigo-100 dark:hover:shadow-none hover:scale-[1.01] active:scale-99"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Archivo</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
