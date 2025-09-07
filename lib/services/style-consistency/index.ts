/**
 * Style Consistency Service - 인덱스 파일
 * Task 010: Ensure Image Style Consistency
 */

export { StyleExtractionService } from './StyleExtractionService';
export { UserStyleManager } from './UserStyleManager';
export { StyleApplicator } from './StyleApplicator';
export { 
  ImageStyleConsistencyService,
  createImageStyleConsistencyService,
  getImageStyleConsistencyService
} from './ImageStyleConsistencyService';

export type {
  StyleParameters,
  ExtractedStyle,
  UserStylePreferences,
  StyleHistoryEntry,
  StyleConsistencyOptions,
  StyleApplicationResult,
  ImageStyleConsistency
} from './types';
