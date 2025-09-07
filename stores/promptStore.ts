/**
 * 프롬프트 선택 상태 관리 스토어
 * Zustand를 사용한 전역 상태 관리
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  PromptSelectionState,
  PromptTemplate,
  MainCategory,
  SubCategory,
  PromptFilterOptions,
  PromptStatistics
} from '@/lib/prompts/types';
import { 
  ALL_TEMPLATES, 
  getTemplateById,
  getTemplatesBySubcategory,
  DEFAULT_TEMPLATE 
} from '@/lib/prompts/data/templates';
import { 
  CATEGORIES, 
  DEFAULT_CATEGORY, 
  DEFAULT_SUBCATEGORY 
} from '@/lib/prompts/data/categories';
import {
  generatePromptFromTemplate,
  validatePromptVariables,
  getDefaultVariableValues,
  searchPromptTemplates,
  sortPromptTemplates,
  countTemplatesByCategory
} from '@/lib/prompts/utils';

/**
 * 프롬프트 스토어 상태 인터페이스
 */
interface PromptStoreState extends PromptSelectionState {
  // 데이터
  allTemplates: PromptTemplate[];
  filteredTemplates: PromptTemplate[];
  
  // 필터 및 검색
  filterOptions: PromptFilterOptions;
  searchQuery: string;
  
  // UI 상태
  isLoading: boolean;
  error: string | null;
  showPreview: boolean;
  previewMode: 'simple' | 'detailed';
  
  // 통계
  statistics: PromptStatistics | null;
  
  // 최근 사용한 템플릿
  recentlyUsed: PromptTemplate[];
  
  // 즐겨찾기
  favoriteTemplates: string[];
}

/**
 * 프롬프트 스토어 액션 인터페이스
 */
interface PromptStoreActions {
  // 카테고리 선택
  setSelectedCategory: (category: MainCategory | null) => void;
  setSelectedSubcategory: (subcategory: SubCategory | null) => void;
  setSelectedTemplate: (template: PromptTemplate | null) => void;
  
  // 변수 값 설정
  setVariableValue: (key: string, value: any) => void;
  setVariableValues: (values: Record<string, any>) => void;
  resetVariableValues: () => void;
  
  // 프롬프트 생성
  generatePrompt: () => void;
  setGeneratedPrompt: (prompt: string) => void;
  
  // 템플릿 관리
  loadTemplates: () => Promise<void>;
  refreshTemplates: () => void;
  addToRecentlyUsed: (template: PromptTemplate) => void;
  
  // 필터링 및 검색
  setSearchQuery: (query: string) => void;
  setFilterOptions: (options: Partial<PromptFilterOptions>) => void;
  applyFilters: () => void;
  clearFilters: () => void;
  
  // 즐겨찾기
  toggleFavorite: (templateId: string) => void;
  getFavoriteTemplates: () => PromptTemplate[];
  
  // UI 상태
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setShowPreview: (show: boolean) => void;
  setPreviewMode: (mode: 'simple' | 'detailed') => void;
  
  // 통계
  updateStatistics: () => void;
  
  // 초기화
  reset: () => void;
  resetSelection: () => void;
}

type PromptStore = PromptStoreState & PromptStoreActions;

/**
 * 초기 상태
 */
const initialState: PromptStoreState = {
  // 선택 상태
  selectedCategory: null,
  selectedSubcategory: null,
  selectedTemplate: null,
  variableValues: {},
  generatedPrompt: '',
  
  // 데이터
  allTemplates: ALL_TEMPLATES,
  filteredTemplates: ALL_TEMPLATES,
  
  // 필터 및 검색
  filterOptions: {},
  searchQuery: '',
  
  // UI 상태
  isLoading: false,
  error: null,
  showPreview: true,
  previewMode: 'simple',
  
  // 통계
  statistics: null,
  
  // 최근 사용
  recentlyUsed: [],
  
  // 즐겨찾기
  favoriteTemplates: []
};

/**
 * 프롬프트 스토어 생성
 */
export const usePromptStore = create<PromptStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // 카테고리 선택
        setSelectedCategory: (category) => {
          set((state) => {
            const newState = {
              ...state,
              selectedCategory: category,
              selectedSubcategory: null,
              selectedTemplate: null,
              variableValues: {},
              generatedPrompt: ''
            };
            
            // 필터 적용
            if (category) {
              const filtered = state.allTemplates.filter(t => t.category === category);
              newState.filteredTemplates = filtered;
            } else {
              newState.filteredTemplates = state.allTemplates;
            }
            
            return newState;
          });
        },

        setSelectedSubcategory: (subcategory) => {
          set((state) => {
            const newState = {
              ...state,
              selectedSubcategory: subcategory,
              selectedTemplate: null,
              variableValues: {},
              generatedPrompt: ''
            };
            
            // 필터 적용
            if (state.selectedCategory && subcategory) {
              const filtered = state.allTemplates.filter(
                t => t.category === state.selectedCategory && t.subcategory === subcategory
              );
              newState.filteredTemplates = filtered;
            }
            
            return newState;
          });
        },

        setSelectedTemplate: (template) => {
          set((state) => {
            let newVariableValues = {};
            
            if (template) {
              // 기본 변수값 설정
              newVariableValues = getDefaultVariableValues(template);
              
              // 최근 사용 목록에 추가
              get().addToRecentlyUsed(template);
            }
            
            return {
              ...state,
              selectedTemplate: template,
              variableValues: newVariableValues,
              generatedPrompt: '',
              error: null
            };
          });
        },

        // 변수 값 설정
        setVariableValue: (key, value) => {
          set((state) => ({
            ...state,
            variableValues: {
              ...state.variableValues,
              [key]: value
            }
          }));
        },

        setVariableValues: (values) => {
          set((state) => ({
            ...state,
            variableValues: {
              ...state.variableValues,
              ...values
            }
          }));
        },

        resetVariableValues: () => {
          set((state) => {
            const template = state.selectedTemplate;
            if (!template) return state;
            
            return {
              ...state,
              variableValues: getDefaultVariableValues(template)
            };
          });
        },

        // 프롬프트 생성
        generatePrompt: () => {
          const state = get();
          const { selectedTemplate, variableValues } = state;
          
          if (!selectedTemplate) {
            set({ error: '템플릿을 선택해주세요.' });
            return;
          }

          // 변수 검증
          const validation = validatePromptVariables(selectedTemplate, variableValues);
          if (!validation.isValid) {
            set({ error: validation.errors.map(e => e.message).join(', ') });
            return;
          }

          // 프롬프트 생성
          const result = generatePromptFromTemplate(selectedTemplate, variableValues);
          
          if (result.success) {
            set({
              generatedPrompt: result.prompt,
              error: null
            });
          } else {
            set({
              error: result.error || '프롬프트 생성에 실패했습니다.',
              generatedPrompt: ''
            });
          }
        },

        setGeneratedPrompt: (prompt) => {
          set({ generatedPrompt: prompt });
        },

        // 템플릿 관리
        loadTemplates: async () => {
          set({ isLoading: true, error: null });
          
          try {
            // 실제 구현에서는 API 호출
            await new Promise(resolve => setTimeout(resolve, 500));
            
            set({
              allTemplates: ALL_TEMPLATES,
              filteredTemplates: ALL_TEMPLATES,
              isLoading: false
            });
            
            get().updateStatistics();
          } catch (error) {
            set({
              error: '템플릿을 불러오는데 실패했습니다.',
              isLoading: false
            });
          }
        },

        refreshTemplates: () => {
          get().loadTemplates();
        },

        addToRecentlyUsed: (template) => {
          set((state) => {
            const filtered = state.recentlyUsed.filter(t => t.id !== template.id);
            const updated = [template, ...filtered].slice(0, 10); // 최대 10개
            
            return {
              ...state,
              recentlyUsed: updated
            };
          });
        },

        // 필터링 및 검색
        setSearchQuery: (query) => {
          set({ searchQuery: query });
          get().applyFilters();
        },

        setFilterOptions: (options) => {
          set((state) => ({
            filterOptions: {
              ...state.filterOptions,
              ...options
            }
          }));
          get().applyFilters();
        },

        applyFilters: () => {
          const { allTemplates, filterOptions, searchQuery } = get();
          let filtered = [...allTemplates];

          // 카테고리 필터
          if (filterOptions.categories?.length) {
            filtered = filtered.filter(t => filterOptions.categories!.includes(t.category));
          }

          // 서브카테고리 필터
          if (filterOptions.subcategories?.length) {
            filtered = filtered.filter(t => filterOptions.subcategories!.includes(t.subcategory));
          }

          // 태그 필터
          if (filterOptions.tags?.length) {
            filtered = filtered.filter(t => 
              t.tags?.some(tag => filterOptions.tags!.includes(tag))
            );
          }

          // 검색어 필터
          if (searchQuery.trim()) {
            filtered = searchPromptTemplates(filtered, searchQuery.trim());
          }

          // 정렬
          if (filterOptions.sortBy) {
            filtered = sortPromptTemplates(
              filtered, 
              filterOptions.sortBy, 
              filterOptions.sortOrder
            );
          }

          set({ filteredTemplates: filtered });
        },

        clearFilters: () => {
          set({
            filterOptions: {},
            searchQuery: '',
            filteredTemplates: get().allTemplates
          });
        },

        // 즐겨찾기
        toggleFavorite: (templateId) => {
          set((state) => {
            const isFavorite = state.favoriteTemplates.includes(templateId);
            const updated = isFavorite
              ? state.favoriteTemplates.filter(id => id !== templateId)
              : [...state.favoriteTemplates, templateId];
            
            return {
              ...state,
              favoriteTemplates: updated
            };
          });
        },

        getFavoriteTemplates: () => {
          const { allTemplates, favoriteTemplates } = get();
          return allTemplates.filter(t => favoriteTemplates.includes(t.id));
        },

        // UI 상태
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        setShowPreview: (show) => set({ showPreview: show }),
        setPreviewMode: (mode) => set({ previewMode: mode }),

        // 통계
        updateStatistics: () => {
          const { allTemplates, recentlyUsed } = get();
          
          const statistics: PromptStatistics = {
            totalTemplates: allTemplates.length,
            categoryCounts: countTemplatesByCategory(allTemplates),
            popularTemplates: sortPromptTemplates(
              allTemplates, 
              'popularity', 
              'desc'
            ).slice(0, 5),
            recentlyUsed: recentlyUsed.slice(0, 5)
          };
          
          set({ statistics });
        },

        // 초기화
        reset: () => {
          set({
            ...initialState,
            allTemplates: get().allTemplates // 템플릿 데이터는 유지
          });
        },

        resetSelection: () => {
          set({
            selectedCategory: null,
            selectedSubcategory: null,
            selectedTemplate: null,
            variableValues: {},
            generatedPrompt: '',
            error: null
          });
        }
      }),
      {
        name: 'prompt-store',
        partialize: (state) => ({
          // 지속화할 데이터만 선택
          recentlyUsed: state.recentlyUsed,
          favoriteTemplates: state.favoriteTemplates,
          filterOptions: state.filterOptions,
          showPreview: state.showPreview,
          previewMode: state.previewMode
        })
      }
    ),
    { name: 'prompt-store' }
  )
);

/**
 * 셀렉터 훅들
 */
export const usePromptSelection = () => {
  return usePromptStore((state) => ({
    selectedCategory: state.selectedCategory,
    selectedSubcategory: state.selectedSubcategory,
    selectedTemplate: state.selectedTemplate,
    variableValues: state.variableValues,
    generatedPrompt: state.generatedPrompt
  }));
};

export const usePromptTemplates = () => {
  return usePromptStore((state) => ({
    allTemplates: state.allTemplates,
    filteredTemplates: state.filteredTemplates,
    isLoading: state.isLoading,
    error: state.error
  }));
};

export const usePromptFilters = () => {
  return usePromptStore((state) => ({
    filterOptions: state.filterOptions,
    searchQuery: state.searchQuery,
    setSearchQuery: state.setSearchQuery,
    setFilterOptions: state.setFilterOptions,
    applyFilters: state.applyFilters,
    clearFilters: state.clearFilters
  }));
};

export const usePromptActions = () => {
  return usePromptStore((state) => ({
    setSelectedCategory: state.setSelectedCategory,
    setSelectedSubcategory: state.setSelectedSubcategory,
    setSelectedTemplate: state.setSelectedTemplate,
    setVariableValue: state.setVariableValue,
    setVariableValues: state.setVariableValues,
    generatePrompt: state.generatePrompt,
    resetSelection: state.resetSelection
  }));
};

export const usePromptUI = () => {
  return usePromptStore((state) => ({
    showPreview: state.showPreview,
    previewMode: state.previewMode,
    setShowPreview: state.setShowPreview,
    setPreviewMode: state.setPreviewMode
  }));
};

/**
 * 스토어 초기화 (앱 시작 시 호출)
 */
export const initializePromptStore = () => {
  const store = usePromptStore.getState();
  store.loadTemplates();
  store.updateStatistics();
};