import React, { useState, useEffect } from 'react';
import { X, Save, Tag, Tag as TagIcon, Plus, AlertCircle, FileText } from 'lucide-react';
import { StoredFile } from '../types';

interface EditModalProps {
  file: StoredFile | null;
  onClose: () => void;
  onSave: (id: string, name: string, description: string, tags: string[]) => void;
}

export default function EditModal({ file, onClose, onSave }: EditModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (file) {
      setName(file.name);
      setDescription(file.description);
      setTags([...file.tags]);
      setErrorMsg('');
    }
  }, [file]);

  // Handle ESC key close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!file) return null;

  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTag = currentTag.trim().toLowerCase();
    if (!cleanTag) return;
    
    if (tags.includes(cleanTag)) {
      setErrorMsg(`La etiqueta "${cleanTag}" ya existe.`);
      return;
    }

    if (cleanTag.length > 20) {
      setErrorMsg('Las etiquetas deben tener un máximo de 20 caracteres.');
      return;
    }

    setTags([...tags, cleanTag]);
    setCurrentTag('');
    setErrorMsg('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('El nombre del archivo no puede estar vacío.');
      return;
    }

    onSave(file.id, cleanName, description.trim(), tags);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      {/* Click outside backdrop container */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Edit Modal Content Box */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden z-10 border border-slate-100 dark:border-slate-800 animate-fade-in">
        
        {/* Header toolbar */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                Editar Información
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate max-w-[200px]">
                {file.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input forms form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-center space-x-2 p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl border border-rose-100/30">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Filename input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              Nombre de archivo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrorMsg('');
              }}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 text-slate-800 dark:text-slate-200 transition-shadow"
              placeholder="Ej. mi_foto_viaje.png"
            />
          </div>

          {/* Description textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              Descripción del archivo
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={250}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 text-slate-800 dark:text-slate-200 transition-shadow resize-none"
              placeholder="Escribe detalles breves, notas de estudio, o comentarios del archivo..."
            />
            <div className="text-right text-[10px] text-slate-400 font-mono">
              {description.length}/250 caps
            </div>
          </div>

          {/* Tags managers fields */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              Etiquetas
            </label>

            {/* Display tags */}
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="flex items-center space-x-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-750 dark:text-slate-300 px-2.5 py-1 rounded-md"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-slate-450 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none pl-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic pb-2">Sin etiquetas asignadas. Añade una abajo.</p>
            )}

            {/* Add tag input row */}
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <TagIcon className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => {
                    setCurrentTag(e.target.value);
                    setErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Añadir etiqueta (ej. universidad)"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-indigo-55 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 dark:text-indigo-400 rounded-xl transition-colors font-semibold text-xs flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>
          </div>

          {/* Action buttons bar */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 text-slate-500 dark:text-slate-400 font-semibold text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors flex items-center space-x-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
