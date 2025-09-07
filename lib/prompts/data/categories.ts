/**
 * 카테고리 데이터 정의
 * 프롬프트 시스템의 카테고리 및 서브카테고리 정보
 */

import { CategoryInfo, MainCategory } from '../types';

/**
 * 카테고리별 상세 정보
 */
export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'relationship',
    name: '관계 설정',
    description: 'AI와의 관계를 설정합니다',
    icon: '💝',
    color: '#FF6B6B',
    subcategories: [
      {
        id: 'romantic',
        name: '연인',
        description: '로맨틱한 관계의 AI 파트너',
        parentCategory: 'relationship',
        icon: '❤️'
      },
      {
        id: 'friendship',
        name: '친구',
        description: '편안하고 친근한 친구 관계',
        parentCategory: 'relationship',
        icon: '🤝'
      },
      {
        id: 'professional',
        name: '직장/비즈니스',
        description: '전문적이고 비즈니스적인 관계',
        parentCategory: 'relationship',
        icon: '💼'
      },
      {
        id: 'family',
        name: '가족',
        description: '따뜻한 가족 같은 관계',
        parentCategory: 'relationship',
        icon: '👨‍👩‍👧‍👦'
      },
      {
        id: 'mentor',
        name: '멘토/조언자',
        description: '지혜롭고 도움을 주는 멘토',
        parentCategory: 'relationship',
        icon: '🎓'
      }
    ]
  },
  {
    id: 'personality',
    name: '성격 특성',
    description: 'AI의 성격과 특성을 설정합니다',
    icon: '✨',
    color: '#4ECDC4',
    subcategories: [
      {
        id: 'cheerful',
        name: '밝고 긍정적',
        description: '항상 밝고 긍정적인 에너지',
        parentCategory: 'personality',
        icon: '😊'
      },
      {
        id: 'calm',
        name: '차분하고 이성적',
        description: '침착하고 논리적인 성격',
        parentCategory: 'personality',
        icon: '🧘'
      },
      {
        id: 'passionate',
        name: '열정적',
        description: '열정적이고 에너지 넘치는 성격',
        parentCategory: 'personality',
        icon: '🔥'
      },
      {
        id: 'gentle',
        name: '온화하고 부드러운',
        description: '따뜻하고 배려심 깊은 성격',
        parentCategory: 'personality',
        icon: '🌸'
      },
      {
        id: 'playful',
        name: '장난스럽고 유머러스',
        description: '재미있고 유쾌한 성격',
        parentCategory: 'personality',
        icon: '😄'
      },
      {
        id: 'serious',
        name: '진지하고 신중한',
        description: '신중하고 깊이 있는 성격',
        parentCategory: 'personality',
        icon: '🤔'
      }
    ]
  },
  {
    id: 'situation',
    name: '상황 설정',
    description: '대화 상황과 목적을 설정합니다',
    icon: '🎭',
    color: '#A8E6CF',
    subcategories: [
      {
        id: 'daily',
        name: '일상 대화',
        description: '평범한 일상적인 대화',
        parentCategory: 'situation',
        icon: '☕'
      },
      {
        id: 'support',
        name: '위로/지원',
        description: '힘든 상황에서의 위로와 지원',
        parentCategory: 'situation',
        icon: '🤗'
      },
      {
        id: 'celebration',
        name: '축하/기념',
        description: '특별한 날을 축하하고 기념',
        parentCategory: 'situation',
        icon: '🎉'
      },
      {
        id: 'advice',
        name: '조언/상담',
        description: '고민 상담과 조언',
        parentCategory: 'situation',
        icon: '💡'
      },
      {
        id: 'entertainment',
        name: '엔터테인먼트',
        description: '재미있는 놀이와 오락',
        parentCategory: 'situation',
        icon: '🎮'
      },
      {
        id: 'learning',
        name: '학습/교육',
        description: '새로운 것을 배우고 학습',
        parentCategory: 'situation',
        icon: '📚'
      }
    ]
  },
  {
    id: 'interaction',
    name: '상호작용 스타일',
    description: '대화 방식과 스타일을 설정합니다',
    icon: '💬',
    color: '#FFD93D',
    subcategories: [
      {
        id: 'casual',
        name: '캐주얼한 대화',
        description: '편안하고 자연스러운 대화',
        parentCategory: 'interaction',
        icon: '👋'
      },
      {
        id: 'formal',
        name: '격식있는 대화',
        description: '정중하고 격식을 갖춘 대화',
        parentCategory: 'interaction',
        icon: '🎩'
      },
      {
        id: 'emotional',
        name: '감정적 교류',
        description: '감정을 깊이 나누는 대화',
        parentCategory: 'interaction',
        icon: '💕'
      },
      {
        id: 'intellectual',
        name: '지적인 대화',
        description: '깊이 있는 지적 대화',
        parentCategory: 'interaction',
        icon: '🧠'
      },
      {
        id: 'playful_banter',
        name: '재미있는 농담',
        description: '유쾌한 농담과 장난',
        parentCategory: 'interaction',
        icon: '😜'
      },
      {
        id: 'deep_talk',
        name: '깊은 대화',
        description: '진솔하고 깊이 있는 대화',
        parentCategory: 'interaction',
        icon: '🌙'
      }
    ]
  }
];

/**
 * 카테고리 ID로 카테고리 정보 가져오기
 */
export const getCategoryById = (id: MainCategory): CategoryInfo | undefined => {
  return CATEGORIES.find(cat => cat.id === id);
};

/**
 * 서브카테고리 ID로 서브카테고리 정보 가져오기
 */
export const getSubcategoryById = (id: string): any => {
  for (const category of CATEGORIES) {
    const subcategory = category.subcategories.find(sub => sub.id === id);
    if (subcategory) {
      return subcategory;
    }
  }
  return undefined;
};

/**
 * 특정 카테고리의 서브카테고리 목록 가져오기
 */
export const getSubcategoriesByCategory = (categoryId: MainCategory) => {
  const category = getCategoryById(categoryId);
  return category ? category.subcategories : [];
};

/**
 * 모든 서브카테고리 목록 가져오기
 */
export const getAllSubcategories = () => {
  return CATEGORIES.flatMap(cat => cat.subcategories);
};

/**
 * 카테고리 매핑 객체
 */
export const CATEGORY_MAP = CATEGORIES.reduce((acc, category) => {
  acc[category.id] = category;
  return acc;
}, {} as Record<MainCategory, CategoryInfo>);

/**
 * 서브카테고리 매핑 객체
 */
export const SUBCATEGORY_MAP = getAllSubcategories().reduce((acc, subcategory) => {
  acc[subcategory.id] = subcategory;
  return acc;
}, {} as Record<string, any>);

/**
 * 카테고리별 서브카테고리 ID 매핑
 */
export const CATEGORY_SUBCATEGORY_MAP: Record<MainCategory, string[]> = {
  relationship: ['romantic', 'friendship', 'professional', 'family', 'mentor'],
  personality: ['cheerful', 'calm', 'passionate', 'gentle', 'playful', 'serious'],
  situation: ['daily', 'support', 'celebration', 'advice', 'entertainment', 'learning'],
  interaction: ['casual', 'formal', 'emotional', 'intellectual', 'playful_banter', 'deep_talk']
};

/**
 * 기본 카테고리 설정
 */
export const DEFAULT_CATEGORY: MainCategory = 'relationship';
export const DEFAULT_SUBCATEGORY: Record<MainCategory, string> = {
  relationship: 'friendship',
  personality: 'cheerful',
  situation: 'daily',
  interaction: 'casual'
};