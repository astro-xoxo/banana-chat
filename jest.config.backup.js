const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js 앱의 경로 (package.json 위치)
  dir: './',
})

// Jest에 추가할 설정
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '**/*.test.{js,jsx,ts,tsx}',
    '**/*.spec.{js,jsx,ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/dist/'
  ],
  moduleNameMapper: {
    // 절대 경로 임포트를 위한 매핑
    '^@/(.*): '<rootDir>/$1',
    '^~/(.*): '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  // TypeScript 파일을 위한 변환 설정
  transform: {
    '^.+\\.(js|jsx|ts|tsx): ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  verbose: true,
}

// Next.js Jest 설정과 커스텀 설정을 결합
module.exports = createJestConfig(customJestConfig)