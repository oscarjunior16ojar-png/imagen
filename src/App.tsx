/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  FolderOpen,
  Lock,
  Unlock,
  Share2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Key,
  ShieldCheck,
  Download,
  Plus,
  Sparkles
} from 'lucide-react';
import { StoredFile, FileCategory, FileStats } from './types';
import { getAllFilesFromDB, saveFileToDB, deleteFileFromDB, updateFileFieldsInDB } from './db';
import { determineFileCategory, formatFileSize, blobToBase64, base64ToBlob } from './utils';

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
  
  // Status alerts & states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Read-only / Security Lock states
  const [isLocked, setIsLocked] = useState(false);
  const [lockPin, setLockPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'set' | 'verify'>('set');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Share system states
  const [isSharedView, setIsSharedView] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Active Modals state
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [editFile, setEditFile] = useState<StoredFile | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Showcase Carousel state
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Load initial files or parsed sharing link from URL Hash
  useEffect(() => {
    const handleUrlStateLoad = async () => {
      setIsLoading(true);
      const hash = window.location.hash;
      if (hash && hash.startsWith('#shared=')) {
        try {
          const dataPayload = hash.substring(8);
          // Safety decoded conversion
          const decodedStr = decodeURIComponent(escape(atob(dataPayload)));
          const parsed = JSON.parse(decodedStr);

          // Reconstruct original StoredFile array with reconstituted blobs
          const reconstructedFiles: StoredFile[] = parsed.map((item: any) => {
            let fileBlob: Blob;
            if (item.b64) {
              fileBlob = base64ToBlob(item.b64, item.type);
            } else {
              // Reconstruct small mock visual if file too big for hash transport
              fileBlob = new Blob([new ArrayBuffer(item.size)], { type: item.type });
            }

            return {
              id: item.id,
              name: item.name,
              type: item.type,
              size: item.size,
              blob: fileBlob,
              tags: item.tags || [],
              description: item.description || '',
              createdAt: item.createdAt || Date.now()
            };
          });

          setFiles(reconstructedFiles);
          setIsSharedView(true);
          setSuccessMsg('Abierto con éxito desde enlace compartido. Los cambios están deshabilitados (Modo Lectura).');
          setErrorMsg(null);
        } catch (err) {
          console.error('Error al decodificar enlace compartido:', err);
          setErrorMsg('El enlace de compartición es inválido, ha caducado o está incompleto.');
          await loadFiles();
        } finally {
          setIsLoading(false);
        }
      } else {
        await loadFiles();
      }
    };

    handleUrlStateLoad();
    
    // Check local preferences for Dark Mode
    const savedDarkTheme = localStorage.getItem('theme-dark') === 'true';
    if (savedDarkTheme) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Load static PIN security configurations from browser storage
    const savedLock = localStorage.getItem('vault-locked') === 'true';
    const savedPin = localStorage.getItem('vault-pin') || '';
    if (savedLock && savedPin) {
      setIsLocked(true);
      setLockPin(savedPin);
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
      setErrorMsg('No se pudo acceder al almacenamiento local IndexedDB de este navegador.');
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

  // Upload/Save multiple files to DB (only if not locked/shared)
  const handleFilesUploaded = async (newRawFiles: File[]) => {
    if (isLocked || isSharedView) {
      setErrorMsg('El almacén se encuentra protegido o en modo lectura. Desbloquéalo para agregar archivos.');
      return;
    }
    setIsLoading(true);
    try {
      for (const rawFile of newRawFiles) {
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const category = determineFileCategory(rawFile.type, rawFile.name);
        
        const storedFile: StoredFile = {
          id: fileId,
          name: rawFile.name,
          type: rawFile.type || 'application/octet-stream',
          size: rawFile.size,
          blob: rawFile,
          tags: category === 'image' ? ['foto'] : ['archivo'],
          description: '',
          createdAt: Date.now()
        };

        await saveFileToDB(storedFile);
      }
      
      setSuccessMsg(`Se acaban de cargar y guardar tus ${newRawFiles.length} archivos en el navegador.`);
      await loadFiles();
    } catch (err) {
      console.error(err);
      setErrorMsg('Ocurrió un error al guardar los archivos en tu navegador.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete single file (guarded)
  const handleFileDelete = async (id: string) => {
    if (isLocked || isSharedView) {
      setErrorMsg('Acción prohibida. No puedes eliminar archivos mientras el almacén esté bloqueado.');
      return;
    }
    setIsLoading(true);
    try {
      await deleteFileFromDB(id);
      if (previewFile?.id === id) setPreviewFile(null);
      if (editFile?.id === id) setEditFile(null);
      await loadFiles();
      setSuccessMsg('Archivo eliminado satisfactoriamente del almacenamiento local.');
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo eliminar el archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update File Metadata (guarded)
  const handleFileMetadataSave = async (id: string, name: string, description: string, tags: string[]) => {
    if (isLocked || isSharedView) {
      setErrorMsg('No puedes editar metadatos mientras el almacén esté cerrado.');
      return;
    }
    setIsLoading(true);
    try {
      await updateFileFieldsInDB(id, { name, description, tags });
      setEditFile(null);
      
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
      setSuccessMsg('Metadatos guardados con total éxito.');
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudieron actualizar los metadatos del archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all files (guarded)
  const handleClearAllFiles = async () => {
    if (isLocked || isSharedView) {
      setErrorMsg('No tienes permiso para borrar el almacén.');
      return;
    }
    setIsLoading(true);
    try {
      for (const file of files) {
        await deleteFileFromDB(file.id);
      }
      setPreviewFile(null);
      setEditFile(null);
      setFiles([]);
      setShowClearConfirm(false);
      setSuccessMsg('Todo tu almacén local ha sido borrado por completo.');
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudieron borrar todos los de manera limpia.');
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

  // URL Hash sharing generator (Compresses files up to 100KB to support real image sharing inline!)
  const generateShareLink = async () => {
    setIsGeneratingShare(true);
    try {
      const elementsToEncode = [];
      for (const item of files) {
        let textOrB64Data = '';
        // If file is smaller than 120KB, serialize fully as Base64 to make it travel in the link!
        if (item.size < 120000) {
          try {
            textOrB64Data = await blobToBase64(item.blob);
          } catch (e) {
            console.error('Error al exportar base64', item.name, e);
          }
        }
        elementsToEncode.push({
          id: item.id,
          name: item.name,
          type: item.type,
          size: item.size,
          description: item.description,
          tags: item.tags,
          createdAt: item.createdAt,
          b64: textOrB64Data
        });
      }

      const jsonStr = JSON.stringify(elementsToEncode);
      // UTF-safe encoding to base64
      const b64Encoded = btoa(unescape(encodeURIComponent(jsonStr)));
      
      const absoluteShareUrl = `${window.location.origin}${window.location.pathname}#shared=${b64Encoded}`;
      setShareUrl(absoluteShareUrl);
      setShowShareModal(true);
      setErrorMsg(null);
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo codificar la colección actual en un enlace de compartición.');
    } finally {
      setIsGeneratingShare(false);
    }
  };

  // Import shared collection to the personal database
  const handleImportCollection = async () => {
    setIsLoading(true);
    try {
      for (const file of files) {
        await saveFileToDB(file);
      }
      // Re-trigger standard load, clear the URL sharing fragment, go to readwrite mode
      window.location.hash = '';
      setIsSharedView(false);
      await loadFiles();
      setSuccessMsg('¡Colección importada con éxito! Ahora se encuentra guardada en tu almacén local permanente.');
    } catch (err) {
      console.error(err);
      setErrorMsg('Ocurrió un error al intentar importar los archivos compartidos.');
    } finally {
      setIsLoading(false);
    }
  };

  // Safe Mode: Lock actions handler
  const handleToggleLockStatus = () => {
    setPinInput('');
    setPinError('');
    if (isLocked) {
      // Prompt for Verification to Unlock
      setPinModalMode('verify');
      setShowPinModal(true);
    } else {
      // Prompt for Set PIN code to lock
      setPinModalMode('set');
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pinInput.trim();
    if (pin.length < 4) {
      setPinError('El PIN de seguridad debe contener al menos 4 dígitos o caracteres.');
      return;
    }

    if (pinModalMode === 'set') {
      // Apply Lock
      setIsLocked(true);
      setLockPin(pin);
      localStorage.setItem('vault-locked', 'true');
      localStorage.setItem('vault-pin', pin);
      setShowPinModal(false);
      setSuccessMsg('Almacén protegido con éxito contra cualquier cambio ("nadie puede cambiar nada").');
    } else {
      // Verify Code to Unlock
      if (pin === lockPin) {
        setIsLocked(false);
        setLockPin('');
        localStorage.setItem('vault-locked', 'false');
        localStorage.removeItem('vault-pin');
        setShowPinModal(false);
        setSuccessMsg('Ceguridad desactivada. Los cambios y cargas ahora están permitidos.');
      } else {
        setPinError('PIN de seguridad incorrecto. Inténtalo de nuevo.');
      }
    }
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

  // Extract strictly images for the Showcase module
  const imageFiles = useMemo(() => {
    return files.filter(f => determineFileCategory(f.type, f.name) === 'image');
  }, [files]);

  // Adjust current index mapping boundary checks
  const safePhotoIdx = useMemo(() => {
    if (imageFiles.length === 0) return 0;
    if (activePhotoIdx >= imageFiles.length) return 0;
    return activePhotoIdx;
  }, [activePhotoIdx, imageFiles]);

  const activePhoto = imageFiles[safePhotoIdx] || null;

  // Render beautiful object url safely for active template showcase photos
  const activePhotoUrl = useMemo(() => {
    if (!activePhoto) return '';
    try {
      return URL.createObjectURL(activePhoto.blob);
    } catch {
      return '';
    }
  }, [activePhoto]);

  // Clean-up generated URL
  useEffect(() => {
    return () => {
      if (activePhotoUrl) {
        URL.revokeObjectURL(activePhotoUrl);
      }
    };
  }, [activePhotoUrl]);

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

  // Slideshow prev/next inside lightbox preview modal
  const handleNextPreview = () => {
    if (!previewFile) return;
    const currentCategory = determineFileCategory(previewFile.type, previewFile.name);
    if (currentCategory !== 'image') return;
    
    const idx = imageFiles.findIndex(f => f.id === previewFile.id);
    if (idx !== -1) {
      const nextIdx = (idx + 1) % imageFiles.length;
      setPreviewFile(imageFiles[nextIdx]);
    }
  };

  const handlePrevPreview = () => {
    if (!previewFile) return;
    const currentCategory = determineFileCategory(previewFile.type, previewFile.name);
    if (currentCategory !== 'image') return;
    
    const idx = imageFiles.findIndex(f => f.id === previewFile.id);
    if (idx !== -1) {
      const prevIdx = (idx - 1 + imageFiles.length) % imageFiles.length;
      setPreviewFile(imageFiles[prevIdx]);
    }
  };

  const copyToClipboardUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F1F3F4] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Dynamic top ambient accent strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />

      {/* Bento Grid Wrapper */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header Block Section */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-900">
          <div className="flex items-center gap-3.5 animate-fade-in">
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <FolderOpen className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-white uppercase flex items-center">
                  CloudVault
                </h1>
                <span className="text-[10px] font-mono tracking-normal text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full font-bold">
                  {isSharedView ? 'Vista Compartida' : 'Navegador Local'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-normal">
                {isSharedView ? 'Visualizando un catálogo compartido en modo protegido de sólo lectura.' : 'Almacenamiento privado seguro protegido por IndexedDB integrado.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            {/* Safe Mode Lock switch tool */}
            {!isSharedView && (
              <button
                onClick={handleToggleLockStatus}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border outline-none cursor-pointer group shadow-sm
                  ${isLocked 
                    ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/60 dark:text-amber-400' 
                    : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                title={isLocked ? 'Haga clic para desbloquear cambios' : 'Haga clic para establecer PIN y bloquear cualquier cambio'}
              >
                {isLocked ? (
                  <>
                    <Lock className="w-4 h-4 text-amber-500 stroke-[2.2] animate-pulse" />
                    <span>Bloqueado (No Cambiable)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                    <span>Proteger Almacén</span>
                  </>
                )}
              </button>
            )}

            {/* Shared view badge banner controller */}
            {isSharedView && (
              <button
                onClick={handleImportCollection}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow shadow-emerald-500/10 cursor-pointer"
                title="Clona esta vista entera a la base de datos de tu propio disco"
              >
                <Plus className="w-4 h-4" />
                <span>Importar a Almacén Local</span>
              </button>
            )}

            {/* Shared view close button */}
            {isSharedView && (
              <button
                onClick={async () => {
                  window.location.hash = '';
                  setIsSharedView(false);
                  await loadFiles();
                  setSuccessMsg('Regresaste a tu colección local privda.');
                }}
                className="px-3 py-2.5 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Salir de Vista Compartida
              </button>
            )}

            {/* Copy Shareable Link generator */}
            {files.length > 0 && (
              <button
                onClick={generateShareLink}
                disabled={isGeneratingShare}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-500/10 cursor-pointer"
                title="Genera un enlace base64 compacto con todas las fotos u archivos para mandar por chat"
              >
                <Share2 className="w-4 h-4" />
                <span>{isGeneratingShare ? 'Generando Enlace...' : 'Compartir Enlace'}</span>
              </button>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 transition-all cursor-pointer"
              title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-500 fill-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Reload data action button */}
            <button
              onClick={loadFiles}
              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 transition-all cursor-pointer"
              title="Actualizar datos IndexedDB"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
            </button>

            {/* Wipe all files */}
            {files.length > 0 && !isLocked && !isSharedView && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
          <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-2xl animate-fade-in text-sm font-medium">
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

        {/* Success Banner */}
        {successMsg && (
          <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-2xl animate-fade-in text-sm font-medium">
            <div className="flex items-center space-x-2.5">
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button 
              onClick={() => setSuccessMsg(null)}
              className="text-xs uppercase tracking-wider font-bold text-emerald-700 hover:underline pl-4"
            >
              Listo
            </button>
          </div>
        )}

        {/* ================= EXTRA PHOTO SHOWCASE MODULE ================= */}
        {/* Satisfies: "pero para fotos sera visible mas imagenes" by rendering multiple pictures side-by-side in an interactive slide and filmstrip ribbon preview */}
        {imageFiles.length > 0 && (
          <section className="bg-indigo-950 dark:bg-slate-900/40 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col md:flex-row gap-6 border border-slate-800">
            
            {/* Visual glow background */}
            <div className="absolute top-0 right-0 w-[500px] h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

            {/* Left Portion: Big Featured Photo viewer slide with detailed meta */}
            <div className="w-full md:w-1/2 flex flex-col justify-between space-y-4 relative z-10">
              <div className="space-y-1">
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 font-bold px-3 py-1 rounded-full font-mono uppercase tracking-wider flex items-center gap-1.5 w-fit">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Galería Pro • Visualizador Dinámico</span>
                </span>
                <p className="text-xl font-bold tracking-tight text-white line-clamp-1">
                  {activePhoto?.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                  <span>Tamaño: {formatFileSize(activePhoto?.size || 0)}</span>
                  <span>•</span>
                  <span>Cargado: {activePhoto && new Date(activePhoto.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Big active photo inside stage */}
              <div 
                className="aspect-video w-full rounded-2xl bg-indigo-900/50 dark:bg-slate-950/80 border border-indigo-800/40 overflow-hidden flex items-center justify-center relative cursor-pointer group"
                onClick={() => activePhoto && setPreviewFile(activePhoto)}
              >
                {activePhotoUrl ? (
                  <img
                    src={activePhotoUrl}
                    alt={activePhoto?.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-4">
                    <ImageIcon className="w-10 h-10 text-indigo-400 mx-auto opacity-50" />
                    <p className="text-xs text-indigo-300 mt-2">No se encuentra previsualización</p>
                  </div>
                )}
                
                {/* Arrow navigation inside ribbon big visualizer */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-[10px] text-indigo-200 truncate pr-6 font-mono font-semibold">Haga clic sobre la foto para previsualizar completo</p>
                  <span className="text-[10px] bg-indigo-600 px-2 py-0.5 rounded font-mono font-bold">
                    {safePhotoIdx + 1} / {imageFiles.length}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIdx((prev) => (prev - 1 + imageFiles.length) % imageFiles.length);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIdx((prev) => (prev + 1) % imageFiles.length);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Portion: Showcase filmstrip of many photos appearing side by side ("visible mas imagenes") */}
            <div className="w-full md:w-1/2 flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-indigo-200">
                  Cinta de Imágenes Disponibles
                </h3>
                <p className="text-xs text-indigo-300/80 leading-relaxed font-normal">
                  Todas las fotos del almacén son visibles aquí en una sola vista. Selecciona cualquiera de las miniaturas de abajo para proyectarla en el visualizador interactivo:
                </p>
              </div>

              {/* Horizontal sliding filmstrip ribbon with border indicators */}
              <div className="flex flex-wrap md:grid md:grid-cols-4 gap-3 overflow-y-auto max-h-[220px] pr-2 scrollbar-thin scrollbar-thumb-indigo-805">
                {imageFiles.map((photo, index) => {
                  const isCurActive = index === safePhotoIdx;
                  // Handle temp blob visualization URL for small miniatures
                  let photoUri = '';
                  try {
                    photoUri = URL.createObjectURL(photo.blob);
                  } catch {}

                  return (
                    <div
                      key={photo.id}
                      onClick={() => setActivePhotoIdx(index)}
                      className={`relative aspect-square md:aspect-video rounded-xl bg-indigo-900/80 border overflow-hidden cursor-pointer group transition-all duration-300
                        ${isCurActive 
                          ? 'border-emerald-400 ring-2 ring-emerald-400 scale-[1.03] shadow-md shadow-emerald-500/10' 
                          : 'border-indigo-800 hover:border-indigo-500 scale-95'
                        }
                      `}
                    >
                      {photoUri ? (
                        <img
                          src={photoUri}
                          alt={photo.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-2">
                          <ImageIcon className="w-5 h-5 text-indigo-300 opacity-60" />
                        </div>
                      )}
                      
                      {/* Name badge small overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 p-1 text-center">
                        <p className="text-[8px] font-semibold text-indigo-200 truncate px-0.5">{photo.name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Showcase Stats indicator bar */}
              <div className="flex items-center justify-between text-xs text-indigo-300 border-t border-indigo-800/60 pt-3 mt-1">
                <span>Total fotos indexadas:</span>
                <span className="font-mono bg-indigo-900/60 px-2.5 py-0.5 rounded font-bold text-emerald-350">
                  {imageFiles.length} imágenes
                </span>
              </div>
            </div>

          </section>
        )}

        {/* Bento Grid layouts */}
        <main className="grid grid-cols-12 gap-5">
          
          {/* BENTO 1: Primary Upload Area (8 columns on lg) */}
          <section className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center min-h-[340px] shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
            {/* Header / Indicator decoration */}
            <div className="absolute top-4 left-6 flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${isLocked || isSharedView ? 'bg-amber-500' : 'bg-indigo-500 animate-pulse'}`} />
              <span className="text-[10px] font-mono tracking-widest text-slate-400 dark:text-slate-500 uppercase font-bold">
                {isLocked || isSharedView ? 'ZONA DE CARGA PROTEGIDA' : 'ZONA DE CARGA ACTIVA'}
              </span>
            </div>

            <div className="h-full flex flex-col justify-center pt-3">
              <UploadZone 
                onFilesSelected={handleFilesUploaded} 
                disabled={isLocked || isSharedView}
              />
            </div>
          </section>

          {/* BENTO 2: Dynamic Categories / Quick stats (4 columns on lg) */}
          <section className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Categorías de Archivo
              </h3>
              <p className="text-xs text-slate-400">
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
                    : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <ImageIcon className="w-5 h-5 opacity-80" />
                  <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${selectedCategory === 'image' ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/45 text-blue-800 dark:text-blue-200'}`}>FOTOS</span>
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
                  <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${selectedCategory === 'other' ? 'bg-white/20' : 'bg-amber-200 dark:bg-amber-900/40 text-amber-850 dark:text-amber-200'}`}>OTROS</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="font-black text-xl tracking-tight">{stats.otherCount} <span className="text-xs font-normal opacity-70">archivos</span></span>
                  <p className="text-[10px] opacity-75">Zip, PDF o ejecutables genéricos</p>
                </div>
              </div>
            </div>
          </section>

          {/* BENTO 3: Storage Available status (indigo/purple theme) (4 columns) */}
          <section className="col-span-12 lg:col-span-4 bg-indigo-950 dark:bg-indigo-900 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col justify-between shadow-lg shadow-indigo-150/45 dark:shadow-none min-h-[220px]">
            <div className="relative z-10 space-y-1">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-widest font-mono">
                Espacio Disponible
              </span>
              <p className="text-4xl font-black tracking-tight pt-1">
                {(100 - parseFloat((stats.totalSize / (1024 * 1024)).toFixed(2)))} <span className="text-lg font-normal opacity-60">MB</span>
              </p>
              <p className="text-[11px] text-indigo-300 font-medium font-mono">
                De 100 MB de disco virtual
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
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Espacio en Navegador</span>
                </div>
                <span className="text-[10px] text-indigo-200 font-mono font-bold">
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
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                  Buscador de Elementos
                </h3>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">
                  Sincronización instantánea
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search query input */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 animate-pulse">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Escribe para filtrar por nombre, etiquetas, descripción o notas..."
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
                    className="w-full px-3 py-2.5 bg-[#F1F3F4]/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
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
                <TagIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Nube de Etiquetas</span>
              </span>

              {uniqueTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:scale-[1.02] cursor-pointer
                      ${!selectedTag 
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm' 
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
                        <span className={`text-[9px] px-1 rounded ${selectedTag === tag ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-705 dark:bg-slate-700 dark:text-slate-400'}`}>
                          {tagCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Ninguna etiqueta ha sido declarada. Subir fotos les asigna la tag "foto" de manera automatizada.</p>
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
                    Explorador Integrado
                  </h2>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-850 text-slate-400 font-mono px-2 py-0.5 rounded font-bold">
                    {processedFiles.length} de {files.length} cargados
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-semibold">
                  Muestra interactiva de fotos y visualización de archivos de texto
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
                    Reseteo filtros
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
                    title="Vista de Fila"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>

            {/* Active filters summary */}
            {(selectedCategory !== 'all' || selectedTag || searchQuery) && (
              <div className="flex flex-wrap gap-2 text-xs items-center font-medium text-slate-400 px-1 py-1 bg-[#F1F3F4]/55 dark:bg-slate-950/25 rounded-xl p-2 md:p-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">FILTROS ACTIVOS:</span>
                {selectedCategory !== 'all' && (
                  <span className="bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 capitalize text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                    <span>Categoría: {selectedCategory === 'image' ? 'Fotos/Imágenes' : selectedCategory === 'document' ? 'Documentos' : 'Otros'}</span>
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
                  <span className="bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 text-slate-705 dark:text-slate-300 italic flex items-center space-x-1">
                    <span>Palabra clave: "{searchQuery}"</span>
                    <button onClick={() => setSearchQuery('')} className="font-semibold pl-1 hover:text-rose-500 cursor-pointer">×</button>
                  </span>
                )}
              </div>
            )}

            {/* Files collection stage layout */}
            {isLoading && files.length === 0 ? (
              <div className="p-32 text-center space-y-4">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-indigo-600 rounded-full" />
                <p className="text-sm text-slate-400 font-semibold font-mono">
                  Sincronizando disco virtual local seguro...
                </p>
              </div>
            ) : processedFiles.length === 0 ? (
              <div className="p-16 py-20 text-center space-y-5 bg-slate-50 dark:bg-slate-950/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="p-4.5 bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-700 rounded-full inline-block shadow-sm animate-bounce">
                  <FolderOpen className="w-10 h-10 stroke-[1.2]" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No se hallaron coincidencias en el catálogo
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    {files.length === 0 
                      ? 'Tu base de datos local se encuentra en blanco. Utiliza la sección de arriba para arrastrar tus fotos y archivos, o haz clic para explorar.' 
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
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-601 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 dark:text-indigo-400 text-xs font-semibold rounded-xl transition-all cursor-pointer"
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
                    readOnly={isLocked || isSharedView}
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
                      className="p-3.5 hover:bg-white dark:hover:bg-slate-900 flex items-center justify-between gap-4 transition-all duration-250 group animate-fade-in"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30 group-hover:text-indigo-500 rounded-xl shrink-0 transition-colors">
                          {category === 'image' ? <ImageIcon className="w-4.5 h-4.5 text-indigo-500 font-bold" /> : <FileText className="w-4.5 h-4.5 text-emerald-500" />}
                        </div>
                        <div className="min-w-0 shrink-1">
                          <h4 
                            onClick={() => setPreviewFile(file)}
                            className="text-xs font-bold text-slate-850 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer truncate max-w-sm font-semibold"
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
                          
                          {/* Hide writing features if locked/shared */}
                          {!isLocked && !isSharedView && (
                            <>
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
                            </>
                          )}
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
            onNext={determineFileCategory(previewFile.type, previewFile.name) === 'image' && imageFiles.length > 1 ? handleNextPreview : undefined}
            onPrev={determineFileCategory(previewFile.type, previewFile.name) === 'image' && imageFiles.length > 1 ? handlePrevPreview : undefined}
          />
        )}

        {editFile && (
          <EditModal
            file={editFile}
            onClose={() => setEditFile(null)}
            onSave={handleFileMetadataSave}
          />
        )}

        {/* ================= PIN SECURITY LOCK DIALOG MODAL ================= */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={() => setShowPinModal(false)} />
            <form onSubmit={handlePinSubmit} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-sm w-full relative z-10 space-y-4 border border-slate-100 dark:border-slate-800 animate-fade-in">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-955 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-2xl w-fit">
                <Key className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {pinModalMode === 'set' ? 'Establecer PIN de Protección' : 'Desbloquear Almacén'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                  {pinModalMode === 'set' 
                    ? 'Escribe un código o PIN de seguridad de 4 dígitos para bloquear el almacén. Nadie podrá subir, editar o borrar ningún archivo hasta introducirlo.' 
                    : 'Ingresa el PIN de seguridad definido para permitir realizar modificaciones nuevamente.'
                  }
                </p>
              </div>

              {pinError && (
                <p className="text-xs text-rose-600 dark:text-rose-450 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-xl p-2.5 font-bold font-mono">
                  {pinError}
                </p>
              )}

              <input
                type="password"
                required
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="Escribe tu código de seguridad..."
                className="w-full text-center tracking-widest text-lg font-black py-2.5 bg-[#F1F3F4]/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white transition-all font-mono"
                autoFocus
              />

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-505 text-slate-550 text-slate-500 font-semibold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  {pinModalMode === 'set' ? 'Proteger y Bloquear' : 'Confirmar PIN'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= COMPACT BASE64 SHARE URL MODAL ================= */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={() => setShowShareModal(false)} />
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-lg w-full relative z-10 space-y-4 border border-slate-100 dark:border-slate-800 animate-fade-in">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-955/40 text-emerald-600 dark:text-emerald-400 rounded-2xl w-fit">
                <Share2 className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
                  Generar Enlace de Compartición
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                  Copia el enlace de abajo para compartir tu catálogo actual con cualquiera. Al abrirlo, ingresarán instantáneamente a tu almacén en **Modo Lectura (sin realizar cambios)**, y podrán ver todas tus fotos e incluso clonar el portafolio a sus propios navegadores:
                </p>
              </div>

              {/* Shared Link Copy Area */}
              <div className="flex gap-2 items-center bg-[#F1F3F4]/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-2.5 rounded-2xl w-full">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-xs text-slate-500 dark:text-slate-400 focus:outline-none select-all truncate pl-1 font-mono"
                />
                <button
                  onClick={copyToClipboardUrl}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {shareCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-450" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-905 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-905 dark:hover:bg-slate-200 font-semibold text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wipe-all database Warning dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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
                  Esta acción eliminará de manera permanente de forma irreversible todos tus archivos, fotos, descripciones y tags guardadas del almacenamiento interno de tu navegador. ¿Quieres continuar?
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-805 text-slate-500 dark:text-slate-400 font-semibold text-xs cursor-pointer"
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
