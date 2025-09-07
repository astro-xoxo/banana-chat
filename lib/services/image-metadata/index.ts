/**
 * Image Metadata Management System
 * 
 * Exports all components of the image metadata management system.
 */

export * from './types';
export * from './ImageMetadataService';
export * from './ImageMetadataDatabase';

// Re-export commonly used instances
export { imageMetadataService } from './ImageMetadataService';
export { imageMetadataDatabase } from './ImageMetadataDatabase';
