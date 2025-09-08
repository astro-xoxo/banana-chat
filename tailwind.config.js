/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '320px',    // 최소 모바일 (LobeChat 패턴)
        'sm': '480px',    // 표준 모바일
        'md': '640px',    // 대형 모바일/작은 태블릿
        'lg': '768px',    // 태블릿
        'xl': '1024px',   // 데스크톱
        '2xl': '1280px',  // 큰 데스크톱
        '3xl': '1536px',  // 초대형 화면
      },
      colors: {
        // ✨ LobeHub UI 실제 색상 시스템 (중성 회색 중심)
        primary: {
          50: '#fef7f4',
          100: '#fdeee6',
          200: '#fad4c1',
          300: '#f7ba9c',
          400: '#f49871',
          DEFAULT: '#FFB805', // 프로젝트 전용 주주색 (#FFB805)
          500: '#FFB805',
          600: '#e6694d',
          700: '#cc5a42',
          800: '#b34a36',
          900: '#993a2b',
        },
        secondary: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          DEFAULT: '#71717a', // 보조 회색
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
        
        // ✨ 의미론적 색상 (LobeHub UI 스타일)
        success: {
          DEFAULT: '#16a34a', // 자연스러운 그린
          hover: '#15803d',
          light: '#dcfce7',
        },
        warning: {
          DEFAULT: '#FFB805', // 밝은 골드 오렌지
          hover: '#E6A605', 
          light: '#FFF0C7',
        },
        error: {
          DEFAULT: '#dc2626', // 명확한 레드
          hover: '#b91c1c',
          light: '#fecaca',
        },
        info: {
          DEFAULT: '#2563eb', // 신뢰감 있는 블루
          hover: '#1d4ed8',
          light: '#dbeafe',
        },
        progress: {
          DEFAULT: 'rgb(59 130 246)', // 프로그레스 바 전용 색상
        },
        
        // ✨ LobeHub UI 배경 색상 시스템
        background: {
          DEFAULT: '#ffffff',
          soft: '#fefefe',
          dim: '#fafafa',
        },
        surface: {
          DEFAULT: '#fafafa', // 카드 배경
          elevated: '#f5f5f5',
          hover: '#f0f0f0',
          active: '#ebebeb',
        },
        border: {
          DEFAULT: '#e5e5e5', // 자연스러운 테두리
          light: '#f0f0f0',
          strong: '#d4d4d4',
        },
        
        // ✨ LobeHub UI 타이포그래피 색상
        foreground: '#171717', // 진한 검은색 (가독성 최우선)
        muted: '#737373', // 중간 회색 텍스트
        inverse: '#ffffff', // 흰색 텍스트
        
        // 호환성을 위한 별칭 (LobeHub UI 스타일로 업데이트)
        text: {
          primary: '#171717',
          secondary: '#404040', 
          muted: '#737373',
          placeholder: '#a3a3a3',
          disabled: '#d4d4d4',
          inverse: '#ffffff',
        },
        
        // LobeHub UI 인터랙티브 상태
        interactive: {
          hover: '#f5f5f5',
          active: '#e5e5e5', 
          disabled: '#fafafa',
          focus: '#f0f0f0',
        },
      },
      
      // LobeChat 스타일 타이포그래피 (더 큰 사이즈, 적절한 line-height)
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '30px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
        '5xl': ['48px', { lineHeight: '56px' }],
      },
      
      // LobeChat 스타일 그림자 시스템 (더 부드럽고 현대적)
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        'card': '0 2px 8px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.08)',
        'hover': '0 4px 12px rgb(0 0 0 / 0.08), 0 2px 6px rgb(0 0 0 / 0.12)',
      },
      
      // LobeChat 스타일 간격 시스템 (더 넉넉한 여백)
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '28': '7rem',
        '32': '8rem',
        '36': '9rem',
        '44': '11rem',
        '52': '13rem',
        '60': '15rem',
        '68': '17rem',
        '76': '19rem',
        '84': '21rem',
        '92': '23rem',
        '100': '25rem',
        '128': '32rem',
        '144': '36rem',
      },
      
      // LobeChat 스타일 높이 시스템 (더 큰 터치 영역)
      minHeight: {
        'button-sm': '36px',
        'button': '48px',
        'button-lg': '56px',
        'input': '48px',
        'card': '80px',
        'avatar': '40px',
        'avatar-sm': '32px',
        'avatar-lg': '48px',
        'touch': '44px',
      },
      
      // LobeChat 스타일 너비 시스템 (아이콘 버튼용)
      minWidth: {
        'button-sm': '36px',
        'button': '48px',
        'button-lg': '56px',
        'input': '48px',
        'touch': '44px',
      },
      
      // LobeChat 스타일 Z-index 레이어
      zIndex: {
        'dropdown': '1000',
        'modal': '1100',
        'toast': '1200',
        'tooltip': '1300',
        'overlay': '900',
        'sidebar': '800',
        'header': '700',
      },
      
      // LobeChat 스타일 성능 최적화 애니메이션
      keyframes: {
        'fade-in': {
          '0%': {
            opacity: '0',
            transform: 'translateZ(0)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateZ(0)'
          }
        },
        'slide-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(1rem) translateZ(0)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) translateZ(0)'
          }
        },
        'slide-down': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-1rem) translateZ(0)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) translateZ(0)'
          }
        },
        'scale-in': {
          '0%': {
            opacity: '0',
            transform: 'scale(0.9) translateZ(0)'
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1) translateZ(0)'
          }
        },
        'shimmer': {
          '0%': {
            backgroundPosition: '-200% 0'
          },
          '100%': {
            backgroundPosition: '200% 0'
          }
        },
        'pulse-subtle': {
          '0%, 100%': {
            opacity: '1'
          },
          '50%': {
            opacity: '0.8'
          }
        }
      },
      
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        // 메시지 애니메이션 (기존 호환성)
        'fade-in-up': 'slide-up 0.3s ease-out forwards'
      },
      
      // 트랜지션 시스템
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
      },
      
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-soft': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      
      // LobeChat 스타일 컨테이너 (더 넓은 최대 너비)
      container: {
        center: true,
        padding: {
          DEFAULT: '1.5rem',
          xs: '1rem',
          sm: '1.5rem',
          lg: '2rem',
          xl: '2.5rem',
          '2xl': '3rem',
        },
        screens: {
          xs: '100%',
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1440px',
          '3xl': '1600px',
        },
      },
      
      // 백드롭 블러
      backdropBlur: {
        xs: '2px',
      },
      
      // 브레이크포인트 컨테이너 쿼리
      supports: {
        'backdrop-blur': 'backdrop-filter: blur(0)',
        'dynamic-viewport': 'height: 100dvh',
      }
    },
  },
  plugins: [],
}
