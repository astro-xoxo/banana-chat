/**
 * 캐릭터 생성 E2E 테스트
 * 실제 사용자 플로우를 시뮬레이션
 */

import { test, expect } from '@playwright/test';

test.describe('캐릭터 생성 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 테스트 전 로그인 (간단한 로그인 페이지 사용)
    await page.goto('/simple-login');
    await page.fill('input[type="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('완전한 캐릭터 생성 플로우가 동작한다', async ({ page }) => {
    // 캐릭터 생성 페이지로 이동
    await page.goto('/create');
    
    // 1단계: 이름 입력
    await expect(page.locator('text=캐릭터 이름')).toBeVisible();
    await page.fill('input[placeholder*="지수"]', '테스트캐릭터');
    await page.click('button:has-text("다음")');
    
    // 2단계: 성별 선택
    await expect(page.locator('text=성별')).toBeVisible();
    await page.click('button:has-text("남성")');
    await page.click('button:has-text("다음")');
    
    // 3단계: 나이 입력
    await expect(page.locator('text=나이')).toBeVisible();
    await page.fill('input[placeholder*="25"]', '25');
    await page.click('button:has-text("다음")');
    
    // 4단계: 관계 입력
    await expect(page.locator('text=상대와의 관계')).toBeVisible();
    await page.fill('input[placeholder*="친구"]', '친구');
    await page.click('button:has-text("다음")');
    
    // 5단계: 상황/컨셉 입력
    await expect(page.locator('text=상황 및 컨셉')).toBeVisible();
    await page.fill('input[placeholder*="카페"]', '카페에서 만나기');
    await page.click('button:has-text("다음")');
    
    // 6단계: 이미지 업로드 (건너뛰기)
    await expect(page.locator('text=이미지 업로드')).toBeVisible();
    await page.click('button:has-text("건너뛰기")');
    
    // 7단계: 최종 확인 및 생성
    await expect(page.locator('text=미리보기')).toBeVisible();
    
    // 입력한 정보가 올바르게 표시되는지 확인
    await expect(page.locator('text=테스트캐릭터')).toBeVisible();
    await expect(page.locator('text=25')).toBeVisible();
    await expect(page.locator('text=친구')).toBeVisible();
    
    // 캐릭터 생성 버튼 클릭
    await page.click('button:has-text("캐릭터 생성")');
    
    // 생성 완료 후 대시보드로 리다이렉트 되는지 확인
    await page.waitForURL('/dashboard', { timeout: 30000 });
    
    // 생성된 캐릭터가 대시보드에 표시되는지 확인
    await expect(page.locator('text=테스트캐릭터')).toBeVisible({ timeout: 10000 });
  });

  test('단계별 유효성 검사가 동작한다', async ({ page }) => {
    await page.goto('/create');
    
    // 이름 없이 다음 버튼 클릭 시 비활성화 상태 확인
    const nextButton = page.locator('button:has-text("다음")');
    await expect(nextButton).toBeDisabled();
    
    // 이름 입력 후 활성화 확인
    await page.fill('input[placeholder*="지수"]', '테스트');
    await expect(nextButton).not.toBeDisabled();
    
    await page.click('button:has-text("다음")');
    
    // 성별 선택 전 다음 버튼 비활성화 확인
    const genderNextButton = page.locator('button:has-text("다음")');
    await expect(genderNextButton).toBeDisabled();
    
    // 성별 선택 후 활성화 확인
    await page.click('button:has-text("여성")');
    await expect(genderNextButton).not.toBeDisabled();
  });

  test('이전 버튼으로 단계 이동이 가능하다', async ({ page }) => {
    await page.goto('/create');
    
    // 첫 번째 단계 완료
    await page.fill('input[placeholder*="지수"]', '테스트');
    await page.click('button:has-text("다음")');
    
    // 두 번째 단계에서 이전 버튼 클릭
    await expect(page.locator('text=성별')).toBeVisible();
    await page.click('button:has-text("이전")');
    
    // 첫 번째 단계로 돌아가고 입력값이 유지되는지 확인
    await expect(page.locator('text=캐릭터 이름')).toBeVisible();
    await expect(page.locator('input[placeholder*="지수"]')).toHaveValue('테스트');
  });

  test('나이 입력 유효성 검사가 동작한다', async ({ page }) => {
    await page.goto('/create');
    
    // 3단계까지 빠르게 이동
    await page.fill('input[placeholder*="지수"]', '테스트');
    await page.click('button:has-text("다음")');
    await page.click('button:has-text("남성")');
    await page.click('button:has-text("다음")');
    
    // 나이 입력 단계
    await expect(page.locator('text=나이')).toBeVisible();
    
    const ageInput = page.locator('input[placeholder*="25"]');
    const nextButton = page.locator('button:has-text("다음")');
    
    // 유효하지 않은 나이 (10세 미만)
    await ageInput.fill('5');
    await expect(nextButton).toBeDisabled();
    
    // 유효하지 않은 나이 (100세 초과)
    await ageInput.fill('150');
    await expect(nextButton).toBeDisabled();
    
    // 유효한 나이
    await ageInput.fill('25');
    await expect(nextButton).not.toBeDisabled();
  });
});