import React, { useState, useEffect } from 'react';
import { Trash2, Download, Eye, Edit3, Calendar, Tag, FileText, Image as ImageIcon, FileCode, File, MoreVertical } from 'lucide-react';
import { StoredFile } from '../types';
import { formatFileSize, determineFileCategory } from '../utils';

interface FileCardProps {
  key?: string;
  file: StoredFile;
  onPreview: (file: StoredFile) => void;
  onDelete: (id: string) => void | Promise<void>;
  onEdit: (file: StoredFile) => void;
  readOnly?: boolean;
}

export default function FileCard({ file, onPreview, onDelete, onEdit, readOnly = false }: FileCardProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);
  const category = determineFileCategory(file.type, file.name);

  useEffect(() => {
    // Generate object URL for image preview if file category is image
    if (category === 'image' && file.blob) {
      const url = URL.createObjectURL(file.blob);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file.blob, category]);

  /**
   * Triggers file download natively in browser.
   */
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getMimeIcon = () => {
    switch (category) {
      case 'image':
        return <ImageIcon className="w-8 h-8 text-indigo-500" />;
      case 'document':
        if (file.name.endsWith('.pdf')) {
          return <FileText className="w-8 h-8 text-rose-500" />;
        }
        return <FileText className="w-8 h-8 text-emerald-500" />;
      default:
        if (file.name.endsWith('.zip') || file.name.endsWith('.rar')) {
          return <File className="w-8 h-8 text-amber-500" />;
        }
        return <FileCode className="w-8 h-8 text-blue-500" />;
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div
      id={`file-card-${file.id}`}
      className="group relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden"
    >
      {/* Thumbnail or Icon container */}
      <div 
        className="relative aspect-video w-full bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={() => onPreview(file)}
      >
        {category === 'image' && imageUrl ? (
          <img
            src={imageUrl}
            alt={file.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex flex-col items-center space-y-2 p-4 transition-transform duration-300 group-hover:scale-105">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-full shadow-sm">
              {getMimeIcon()}
            </div>
            <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {file.name.split('.').pop() || 'GENÉRICO'}
            </span>
          </div>
        )}

        {/* Quick actions hover overlay */}
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview(file);
            }}
            className="p-2.5 bg-white/90 hover:bg-white text-slate-800 rounded-xl hover:scale-115 active:scale-95 transition-all shadow-sm tooltip"
            title="Previsualizar"
          >
            <Eye className="w-4 h-4 text-indigo-600" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2.5 bg-white/90 hover:bg-white text-slate-800 rounded-xl hover:scale-115 active:scale-95 transition-all shadow-sm"
            title="Descargar"
          >
            <Download className="w-4 h-4 text-emerald-600" />
          </button>
          {!readOnly && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(file);
                }}
                className="p-2.5 bg-white/90 hover:bg-white text-slate-800 rounded-xl hover:scale-115 active:scale-95 transition-all shadow-sm"
                title="Editar info"
              >
                <Edit3 className="w-4 h-4 text-amber-600" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.id);
                }}
                className="p-2.5 bg-white/90 hover:bg-white text-slate-800 rounded-xl hover:scale-115 active:scale-95 transition-all shadow-sm"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Metadata and Content */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight line-clamp-1 break-all" title={file.name}>
            {file.name}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed min-h-[2rem]">
            {file.description || 'Sin descripción.'}
          </p>
        </div>

        {/* Tags, Size, and Date row */}
        <div className="space-y-2.5 pt-2 border-t border-slate-50 dark:border-slate-800/40">
          {file.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-12 overflow-hidden">
              {file.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="flex items-center space-x-1 text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md"
                >
                  <Tag className="w-2.5 h-2.5" />
                  <span>{tag}</span>
                </span>
              ))}
              {file.tags.length > 3 && (
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium px-1">
                  +{file.tags.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
            <span className="bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md font-mono font-medium text-slate-650 dark:text-slate-400">
              {formatFileSize(file.size)}
            </span>
            <span className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              <span>{formatDate(file.createdAt)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
