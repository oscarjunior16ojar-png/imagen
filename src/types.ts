/**
 * Types for the Gestor de Archivos y Fotos application.
 */

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  tags: string[];
  description: string;
  createdAt: number;
}

export type FileCategory = 'all' | 'image' | 'document' | 'other';

export interface FileStats {
  totalCount: number;
  totalSize: number;
  imageCount: number;
  docCount: number;
  otherCount: number;
}
