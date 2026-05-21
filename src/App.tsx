/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Folder, 
  Search, 
  Image as ImageIcon, 
  FileText, 
  HelpCircle, 
  RefreshCw, 
  Trash2, 
  Grid, 
  List, 
  Tag as TagIcon,
  Sun, 
  Moon, 
  TrendingUp, 
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { StoredFile, FileCategory, FileStats } from './types';
import { getAllFilesFromDB, saveFileToDB, deleteFileFromDB, updateFileFieldsInDB } from './db';
import { determineFileCategory, formatFileSize } from './utils';

// Import our interactive components
import UploadZone from './components/UploadZone';
import FileCard from './components/FileCard';
import PreviewModal from './components/PreviewModal';
import EditModal from './components/EditModal';

export default function App() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size-desc' | 'size-asc'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [darkMode, setDarkMode] = useState(false);
  
  // Status alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active Modals state
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [editFile, setEditFile] = useState<StoredFile | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load initial files from IndexedDB
  useEffect(() => {
    loadFiles();
    
    // Check local preferences for Dark Mode
    const savedDarkTheme = localStorage.getItem('theme-dark') === 'true';
    if (savedDarkTheme) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const dbFiles = await getAllFilesFromDB();
      setFiles(dbFiles);
      setErrorMsg(null);
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo acceder al almacenamiento local del navegador.');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Dark Mode
  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    localStorage.setItem('theme-dark', String(nextDark));
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Upload/Save multiple files to DB
  const handleFilesUploaded = async (newRawFiles: File[]) => {
    setIsLoading(true);
    try {
      for (const rawFile of newRawFiles) {
        // Read the file as safe ArrayBuffer first, or store as Blob
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const category = determineFileCategory(rawFile.type, rawFile.name);
        
        // Build the StoredFile object
        const storedFile: StoredFile = {
          id: fileId,
          name: rawFile.name,
          type: rawFile.type || 'application/octet-stream',
          size: rawFile.size,
          blob: rawFile, // Blob are fully indexable in IndexedDB
          tags: category === 'image' ? ['foto'] : ['archivo'],
          description: '',
          createdAt: Date.now()
        };

        await saveFileToDB(storedFile);
      }
      
      // Reload the state list
      await loadFiles();
    } catch (err) {
      console.error(err);
      setErrorMsg('Ocurrió un error al guardar los archivos en tu navegador.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete single file
  const handleFileDelete = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteFileFromDB(id);
      // Revoke any active previews of that file
      if (previewFile?.id === id) setPreviewFile(null);
      if (editFile?.id === id) setEditFile(null);
      await loadFiles();
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo eliminar el archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update File Metadata
  const handleFileMetadataSave = async (id: string, name: string, description: string, tags: string[]) => {
    setIsLoading(true);
    try {
      await updateFileFieldsInDB(id, { name, description, tags });
      setEditFile(null);
      // Sync active preview details if it's currently showing
      if (previewFile?.id === id) {
        const updatedFile = files.find(f => f.id === id);
        if (updatedFile) {
          setPreviewFile({
            ...updatedFile,
            name,
            description,
            tags
          });
        }
      }
      await loadFiles();
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudieron actualizar los metadatos del archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all files
  const handleClearAllFiles = async () => {
    setIsLoading(true);
    try {
      for (const file of files) {
        await deleteFileFromDB(file.id);
      }
      setPreviewFile(null);
      setEditFile(null);
      setFiles([]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudieron borrar todos los archivos de manera limpia.');
    } finally {
      setIsLoading(false);
    }
  };

  // Download trigger
  const handleDownloadFile = (file: StoredFile) => {
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Extract all unique tags to build dynamic tag filter cloud
  const uniqueTags = useMemo(() => {
    const tagsSet = new Set<string>();
    files.forEach((f) => {
      f.tags.forEach((tag) => {
        if (tag.trim()) tagsSet.add(tag);
      });
    });
    return Array.from(tagsSet).sort();
  }, [files]);

  // Compute stats
  const stats: FileStats = useMemo(() => {
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    const counts = {
      image: 0,
      document: 0,
      other: 0,
    };
    files.forEach((f) => {
      const cat = determineFileCategory(f.type, f.name);
      if (cat === 'image') counts.image++;
      else if (cat === 'document') counts.document++;
      else counts.other++;
    });

    return {
      totalCount: files.length,
      totalSize,
      imageCount: counts.image,
      docCount: counts.document,
      otherCount: counts.other
    };
  }, [files]);

  // Filters, search, and sort pipelines
  const processedFiles = useMemo(() => {
    let result = [...files];

    // Filter by type
    if (selectedCategory !== 'all') {
      result = result.filter(f => determineFileCategory(f.type, f.name) === selectedCategory);
    }

    // Filter by tag
    if (selectedTag) {
      result = result.filter(f => f.tags.includes(selectedTag));
    }

    // Filter by search text query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        f => 
          f.name.toLowerCase().includes(q) || 
          f.description.toLowerCase().includes(q) ||
          f.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'newest') {
      result.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortBy === 'size-desc') {
      result.sort((a, b) => b.size - a.size);
    } else if (sortBy === 'size-asc') {
      result.sort((a, b) => a.size - b.size);
    }

    return result;
  }, [files, selectedCategory, selectedTag, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#F1F3F4] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Dynamic top ambient accent strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      {/* Bento Grid Wrapper */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header Block Section */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div className="flex items-center gap-3.5 animate-fade-in">
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <FolderOpen className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white uppercase">
                CloudVault <span className="text-[10px] font-mono lowercase tracking-normal text-slate-400 bg-slate-200/50 dark:bg-slate-900 px-2 py-0.5 rounded-full ml-1 font-semibold">Local</span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Almacenamiento privado seguro (IndexedDB)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Storage quick status badge */}
            <div className="hidden md:flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                {formatFileSize(stats.totalSize)} de 100 MB usados
              </span>
              <div className="w-20 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-500" 
                  style={{ width: `${Math.min((stats.totalSize / (1024 * 1024 * 100)) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 transition-all outline-none cursor-pointer"
              title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-500 fill-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Reset/Refresh button */}
            <button
              onClick={loadFiles}
              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 transition-all cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
            </button>

            {/* Wipe all files */}
            {files.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Limpiar base de datos"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Vaciar Todo</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-2xl animate-fade-in text-sm font-medium">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button 
              onClick={() => setErrorMsg(null)}
              className="text-xs uppercase tracking-wider font-bold text-rose-700 hover:underline pl-4"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Bento Grid layout */}
        <main className="grid grid-cols-12 gap-5">
          
          {/* BENTO 1: Primary Upload Area (8 columns on lg) */}
          <section className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center min-h-[340px] shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
            {/* Header / Indicator decoration */}
            <div className="absolute top-4 left-6 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 dark:text-slate-500 uppercase font-bold">ZONA DE CARGA ACTIVA</span>
            </div>

            <div className="h-full flex flex-col justify-center pt-3">
              <UploadZone onFilesSelected={handleFilesUploaded} />
            </div>
          </section>

          {/* BENTO 2: Dynamic Categories / Quick stats (4 columns on lg) */}
          <section className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Categorías de Archivo
              </h3>
              <p className="text-xs text-slate-405 text-slate-400">
                Distribución de tu almacén local
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div 
                onClick={() => {
                  setSelectedCategory('image');
                  setSelectedTag(null);
                }}
                className={`p-3.5 rounded-2xl flex flex-col gap-2.5 cursor-pointer transition-all hover:scale-[1.03] active:scale-95
                  ${selectedCategory === 'image' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-150 dark:shadow-none' 
                    : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-955/20 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <ImageIcon className="w-5 h-5 opacity-80" />
                  <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${selectedCategory === 'image' ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200'}`}>FOTOS</span>
                </div>
                <div className="space-y-0.5">
                  <span className="font-black text-2xl tracking-tight leading-none">{stats.imageCount}</span>
                  <span className="text-[10px] block opacity-70 font-semibold">Elementos</span>
                </div>
              </div>

              <div 
                onClick={() => {
                  setSelectedCategory('document');
                  setSelectedTag(null);
                }}
                className={`p-3.5 rounded-2xl flex flex-col gap-2.5 cursor-pointer transition-all hover:scale-[1.03] active:scale-95
                  ${selectedCategory === 'document' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-150 dark:shadow-none' 
                    : 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-955/20 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <FileText className="w-5 h-5 opacity-80" />
                  <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${selectedCategory === 'document' ? 'bg-white/20' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200'}`}>DOCS</span>
                </div>
                <div className="space-y-0.5">
                  <span className="font-black text-2xl tracking-tight leading-none">{stats.docCount}</span>
                  <span className="text-[10px] block opacity-70 font-semibold">Elementos</span>
                </div>
              </div>

              <div 
                onClick={() => {
                  setSelectedCategory('other');
                  setSelectedTag(null);
                }}
                className={`p-3.5 rounded-2xl flex flex-col gap-2.5 cursor-pointer transition-all hover:scale-[1.03] active:scale-95 col-span-2
                  ${selectedCategory === 'other' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-150 dark:shadow-none' 
                    : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-955/20 dark:bg-amber-950/20 text-amber-950 dark:text-amber-300'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 opacity-80" />
                    <span className="text-xs font-bold leading-none">Otros archivos</span>
                  </div>
                  <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${selectedCategory === 'other' ? 'bg-white/20' : 'bg-amber-105 bg-amber-900/40 text-amber-800 dark:text-amber-200'}`}>OTROS</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="font-black text-xl tracking-tight">{stats.otherCount} <span className="text-xs font-normal opacity-70">archivos</span></span>
                  <p className="text-[10px] opacity-75">Zip, PDF o ejecutables genéricos</p>
                </div>
              </div>
            </div>
          </section>

          {/* BENTO 3: Storage Available status (indigo/purple theme) (4 columns) */}
          <section className="col-span-12 lg:col-span-4 bg-indigo-950 dark:bg-indigo-900 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col justify-between shadow-lg shadow-indigo-150/40 dark:shadow-none min-h-[220px]">
            <div className="relative z-10 space-y-1">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-widest font-mono">
                Espacio Disponible
              </span>
              <p className="text-4xl font-black tracking-tight pt-1">
                {(100 - parseFloat((stats.totalSize / (1024 * 1024)).toFixed(2)))} <span className="text-lg font-normal opacity-60">MB</span>
              </p>
              <p className="text-[11px] text-indigo-300 font-medium">
                De 100 MB totales del sistema local
              </p>
            </div>

            <div className="relative z-10 space-y-3.5 pt-4">
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((stats.totalSize / (1024 * 1024 * 100)) * 100, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1.5 text-xs bg-white/10 w-fit px-2.5 py-1 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Almacenamiento Activo</span>
                </div>
                <span className="text-[10px] text-indigo-250 italic font-mono font-bold">
                  {((stats.totalSize / (1024 * 1024 * 100)) * 100).toFixed(1)}% lleno
                </span>
              </div>
            </div>

            {/* Decorative vector shape background icon */}
            <div className="absolute bottom-[-20px] right-[-20px] w-44 h-44 opacity-10 pointer-events-none">
              <FolderOpen className="w-full h-full text-white" />
            </div>
          </section>

          {/* BENTO 4: Search filter & Tags Cloud (8 columns) */}
          <section className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 gap-5">
            
            {/* Search, order block */}
            <div className="space-y-3.5 w-full">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Filtros Avanzados
                </h3>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">
                  Búsqueda veloz
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search query input */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Escribe para buscar por nombre, tags o notas..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F1F3F4]/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 transition-all"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-slate-400 hover:text-slate-600 font-bold hover:underline cursor-pointer"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Sort selector dropdown */}
                <div className="sm:w-48">
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F1F3F4]/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                  >
                    <option value="newest">Más recientes</option>
                    <option value="oldest">Más antiguos</option>
                    <option value="size-desc">Más grandes (peso)</option>
                    <option value="size-asc">Más pequeños (peso)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tags area */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono tracking-wider text-slate-400 dark:text-slate-500 uppercase font-bold flex items-center space-x-1">
                <TagIcon className="w-3.5 h-3.5" />
                <span>Colección de Etiquetas</span>
              </span>

              {uniqueTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:scale-[1.02] cursor-pointer
                      ${!selectedTag 
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' 
                        : 'bg-slate-100/80 hover:bg-slate-200/50 dark:bg-slate-800/80 dark:text-slate-300'
                      }`}
                  >
                    Todas ({files.length})
                  </button>
                  {uniqueTags.map((tag) => {
                    const tagCount = files.filter(f => f.tags.includes(tag)).length;
                    return (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(tag)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:scale-[1.02] flex items-center space-x-1.5 cursor-pointer
                          ${selectedTag === tag 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'bg-slate-100/80 hover:bg-slate-200/50 dark:bg-slate-800/80 dark:text-slate-300'
                          }`}
                      >
                        <span>{tag}</span>
                        <span className={`text-[9px] px-1 rounded ${selectedTag === tag ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                          {tagCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No hay etiquetas creadas todavía. Las fotos toman tag "foto" y archivos "archivo" de manera automática.</p>
              )}
            </div>

          </section>

          {/* BENTO 5: Full visual File Explorer document board (12 columns) */}
          <section className="col-span-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            
            {/* Exploration header actions bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
              
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                    Explorador de Archivos
                  </h2>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-850 text-slate-400 font-mono px-2 py-0.5 rounded font-bold">
                    {processedFiles.length} de {files.length} cargados
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Previsualiza imágenes, lee archivos de texto e interactúa sin conexión
                </p>
              </div>

              {/* Layout options and clear warnings */}
              <div className="flex items-center gap-3">
                
                {/* Visual filter details row indicator */}
                {(selectedCategory !== 'all' || selectedTag || searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedTag(null);
                      setSearchQuery('');
                    }}
                    className="text-xs font-bold text-indigo-600 hover:underline px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl cursor-pointer"
                  >
                    Limpiar filtros combinados
                  </button>
                )}

                {/* Grid vs List buttons */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-100 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Vista de Cuadrícula"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-100 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Vista Detallada"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>

            {/* Active filters summary */}
            {(selectedCategory !== 'all' || selectedTag || searchQuery) && (
              <div className="flex flex-wrap gap-2 text-xs items-center font-medium text-slate-400 px-1 py-1 bg-[#F1F3F4]/50 dark:bg-slate-950/20 rounded-xl p-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">FILTROS:</span>
                {selectedCategory !== 'all' && (
                  <span className="bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 capitalize text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                    <span>Categoría: {selectedCategory === 'image' ? 'Fotos' : selectedCategory === 'document' ? 'Documentos' : 'Otros'}</span>
                    <button onClick={() => setSelectedCategory('all')} className="font-semibold pl-1 hover:text-rose-500 cursor-pointer">×</button>
                  </span>
                )}
                {selectedTag && (
                  <span className="bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center space-x-1">
                    <span>Etiqueta: {selectedTag}</span>
                    <button onClick={() => setSelectedTag(null)} className="font-semibold pl-1 hover:text-rose-500 cursor-pointer">×</button>
                  </span>
                )}
                {searchQuery && (
                  <span className="bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 italic flex items-center space-x-1">
                    <span>Buscando: "{searchQuery}"</span>
                    <button onClick={() => setSearchQuery('')} className="font-semibold pl-1 hover:text-rose-500 cursor-pointer">×</button>
                  </span>
                )}
              </div>
            )}

            {/* Files collection stage layout */}
            {isLoading && files.length === 0 ? (
              <div className="p-32 text-center space-y-4">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-indigo-600 rounded-full" />
                <p className="text-sm text-slate-400 font-medium">
                  Sincronizando almacenamiento autónomo...
                </p>
              </div>
            ) : processedFiles.length === 0 ? (
              <div className="p-16 py-20 text-center space-y-5 bg-slate-50 dark:bg-slate-950/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="p-4.5 bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-700 rounded-full inline-block shadow-sm">
                  <FolderOpen className="w-10 h-10 stroke-[1.2]" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No se encontraron coincidencias
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {files.length === 0 
                      ? 'Tu base de datos local está en blanco. Utiliza la sección de arriba para arrastrar tus fotos y archivos, o haz clic para explorar.' 
                      : 'Ningún archivo coincide con los filtros aplicados en tu búsqueda.'
                    }
                  </p>
                </div>
                {files.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedTag(null);
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 dark:text-indigo-400 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Ver todos los elementos
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid Layout */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4.5">
                {processedFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onPreview={setPreviewFile}
                    onDelete={handleFileDelete}
                    onEdit={setEditFile}
                  />
                ))}
              </div>
            ) : (
              /* Detailed List items layout */
              <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/60 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
                {processedFiles.map((file) => {
                  const category = determineFileCategory(file.type, file.name);
                  return (
                    <div
                      key={file.id}
                      className="p-3.5 hover:bg-white dark:hover:bg-slate-900 flex items-center justify-between gap-4 transition-all duration-200 group"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30 group-hover:text-indigo-500 rounded-xl shrink-0 transition-colors">
                          {category === 'image' ? <ImageIcon className="w-4.5 h-4.5 text-indigo-500" /> : <FileText className="w-4.5 h-4.5 text-emerald-500" />}
                        </div>
                        <div className="min-w-0 shrink-1">
                          <h4 
                            onClick={() => setPreviewFile(file)}
                            className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer truncate max-w-sm font-semibold"
                          >
                            {file.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate max-w-md hidden sm:block">
                            {file.description || 'Sin notas ni descripción asignadas.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 shrink-0">
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {formatFileSize(file.size)}
                        </span>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Abrir
                          </button>
                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-650 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Bajar
                          </button>
                          <button
                            onClick={() => setEditFile(file)}
                            className="px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleFileDelete(file.id)}
                            className="p-1 px-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </section>

        </main>

        {/* Global Modals container panels */}
        {previewFile && (
          <PreviewModal
            file={previewFile}
            onClose={() => setPreviewFile(null)}
            onDownload={handleDownloadFile}
          />
        )}

        {editFile && (
          <EditModal
            file={editFile}
            onClose={() => setEditFile(null)}
            onSave={handleFileMetadataSave}
          />
        )}

        {/* Wipe-all database Warning dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={() => setShowClearConfirm(false)} />
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-md w-full relative z-10 space-y-4 border border-slate-100 dark:border-slate-800">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl w-fit">
                <Trash2 className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  ¿Vaciar todo el almacén local?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Esta acción eliminará permanentemente de forma irreversible todos tus archivos, fotos y notas guardadas del almacenamiento interno de tu navegador. ¿Quieres continuar?
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearAllFiles}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Sí, vaciar de manera irreversible
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
