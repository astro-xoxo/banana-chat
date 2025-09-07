/**
 * Phase 4-1: Mock 응답 구조 검증 API
 * Phase 2 완료 기반으로 Mock 서비스 응답 구조 검증
 */

import { NextRequest, NextResponse } from 'next/server'
import { MockImageService } from '@/lib/services/mockImageService'
import { PRESET_ID_TO_IMAGE_KEY, MOCK_PROFILE_IMAGES } from '@/lib/mockData'

// 설계 문서 기준 응답 구조 스키마
const EXPECTED_RESPONSE_SCHEMA = {
  success: 'boolean',
  profile_image_url: 'string',
  generation_job_id: 'string',
  processing_time: 'number',
  style_info: {
    preset_used: 'string',
    gender: ['female', 'male'],
    relationship: ['lover', 'friend', 'some', 'family']
  },
  error: 'string', // 실패 시에만
  is_mock: 'boolean' // Mock 서비스 전용
}

/**
 * 응답 구조 검증 함수
 */
function validateResponseSchema(response: any, testName: string): { isValid: boolean; errors: string[] } {
  console.log(`📋 ${testName} - 응답 구조 검증`)
  
  const errors: string[] = []
  
  // 기본 필드 검증
  if (typeof response.success !== 'boolean') {
    errors.push('success 필드가 boolean이 아닙니다')
  }
  
  if (response.success) {
    // 성공 응답 검증
    if (!response.profile_image_url || typeof response.profile_image_url !== 'string') {
      errors.push('profile_image_url 필드가 없거나 string이 아닙니다')
    }
    
    if (!response.generation_job_id || typeof response.generation_job_id !== 'string') {
      errors.push('generation_job_id 필드가 없거나 string이 아닙니다')
    }
    
    if (typeof response.processing_time !== 'number') {
      errors.push('processing_time 필드가 number가 아닙니다')
    }
    
    // style_info 검증 (Phase 2에서 추가된 핵심 구조)
    if (!response.style_info) {
      errors.push('style_info 필드가 없습니다 (Phase 2 필수 구조)')
    } else {
      const styleInfo = response.style_info
      
      if (!styleInfo.preset_used || typeof styleInfo.preset_used !== 'string') {
        errors.push('style_info.preset_used가 없거나 string이 아닙니다')
      }
      
      if (!['female', 'male'].includes(styleInfo.gender)) {
        errors.push(`style_info.gender가 올바르지 않습니다: ${styleInfo.gender}`)
      }
      
      if (!['lover', 'friend', 'some', 'family'].includes(styleInfo.relationship)) {
        errors.push(`style_info.relationship이 올바르지 않습니다: ${styleInfo.relationship}`)
      }
    }
    
    // Mock 서비스 전용 필드
    if (response.is_mock !== true) {
      errors.push('Mock 서비스 응답에는 is_mock이 true여야 합니다')
    }
    
  } else {
    // 실패 응답 검증
    if (!response.error || typeof response.error !== 'string') {
      errors.push('실패 응답에는 error 필드가 필요합니다')
    }
  }
  
  const isValid = errors.length === 0
  
  if (isValid) {
    console.log('✅ 응답 구조 검증 통과')
  } else {
    console.log('❌ 응답 구조 검증 실패:')
    errors.forEach(error => console.log(`   - ${error}`))
  }
  
  return { isValid, errors }
}

/**
 * 모든 프리셋에 대한 Mock 응답 테스트
 */
async function testAllPresets() {
  console.log('🎯 Phase 4-1: 모든 프리셋(8개) Mock 응답 테스트')
  
  const mockService = new MockImageService()
  const results = []
  
  for (const presetId of Object.keys(PRESET_ID_TO_IMAGE_KEY)) {
    console.log(`\n--- 프리셋 ${presetId} 테스트 ---`)
    
    try {
      const testParams = {
        preset_id: presetId,
        user_id: `test_user_${presetId}`,
        chatbot_name: `테스트 캐릭터 ${presetId}`,
        user_image_url: 'https://example.com/test.jpg' // Mock에서는 사용하지 않음
      }
      
      console.log('📤 요청 파라미터:', {
        preset_id: testParams.preset_id,
        user_id: testParams.user_id.substring(0, 8) + '...',
        chatbot_name: testParams.chatbot_name
      })
      
      const response = await mockService.generateProfile(testParams)
      
      console.log('📥 응답 데이터:', {
        success: response.success,
        hasProfileImageUrl: !!response.profile_image_url,
        hasStyleInfo: !!response.style_info,
        processingTime: response.processing_time,
        isMock: response.is_mock,
        styleInfo: response.style_info
      })
      
      // 응답 구조 검증
      const validation = validateResponseSchema(response, `프리셋 ${presetId}`)
      
      // 프리셋별 데이터 일관성 검증
      if (response.success && response.style_info) {
        const expectedImageKey = PRESET_ID_TO_IMAGE_KEY[presetId]
        const expectedImageData = MOCK_PROFILE_IMAGES[expectedImageKey]
        
        console.log('🔍 데이터 일관성 검증:')
        
        const consistencyErrors = []
        
        // gender 검증
        if (response.style_info.gender === expectedImageData.gender) {
          console.log(`✅ gender 일치: ${response.style_info.gender}`)
        } else {
          const error = `gender 불일치: 응답=${response.style_info.gender}, 예상=${expectedImageData.gender}`
          console.log(`❌ ${error}`)
          consistencyErrors.push(error)
        }
        
        // relationship 검증
        if (response.style_info.relationship === expectedImageData.relationshipType) {
          console.log(`✅ relationship 일치: ${response.style_info.relationship}`)
        } else {
          const error = `relationship 불일치: 응답=${response.style_info.relationship}, 예상=${expectedImageData.relationshipType}`
          console.log(`❌ ${error}`)
          consistencyErrors.push(error)
        }
        
        // preset_used 검증
        if (response.style_info.preset_used === presetId) {
          console.log(`✅ preset_used 일치: ${response.style_info.preset_used}`)
        } else {
          const error = `preset_used 불일치: 응답=${response.style_info.preset_used}, 예상=${presetId}`
          console.log(`❌ ${error}`)
          consistencyErrors.push(error)
        }
        
        results.push({
          presetId,
          success: response.success,
          isValid: validation.isValid && consistencyErrors.length === 0,
          response,
          errors: [...validation.errors, ...consistencyErrors]
        })
      } else {
        results.push({
          presetId,
          success: response.success,
          isValid: validation.isValid,
          response,
          errors: validation.errors
        })
      }
      
    } catch (error) {
      console.log(`❌ 프리셋 ${presetId} 테스트 실패:`, error instanceof Error ? error.message : error)
      results.push({
        presetId,
        success: false,
        isValid: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        errors: ['테스트 실행 실패']
      })
    }
  }
  
  return results
}

/**
 * ComfyUI와 Mock 응답 구조 호환성 검증
 */
function validateCompatibility(mockResults: any[]) {
  console.log('\n🔄 Phase 4-1: ComfyUI-Mock 호환성 검증')
  
  const successfulResults = mockResults.filter(r => r.success && r.isValid)
  
  if (successfulResults.length === 0) {
    console.log('❌ 성공한 Mock 응답이 없어 호환성 검증을 수행할 수 없습니다')
    return false
  }
  
  console.log(`📊 검증 대상: ${successfulResults.length}개 성공 응답`)
  
  // 모든 성공 응답이 동일한 구조를 가지는지 검증
  const requiredFields = ['success', 'profile_image_url', 'generation_job_id', 'processing_time', 'style_info', 'is_mock']
  
  let allCompatible = true
  const compatibilityErrors = []
  
  for (const result of successfulResults) {
    const response = result.response
    
    // 필수 필드 존재 확인
    for (const field of requiredFields) {
      if (!(field in response)) {
        const error = `프리셋 ${result.presetId}: ${field} 필드 누락`
        console.log(`❌ ${error}`)
        compatibilityErrors.push(error)
        allCompatible = false
      }
    }
    
    // style_info 하위 필드 확인
    if (response.style_info) {
      const styleFields = ['preset_used', 'gender', 'relationship']
      for (const field of styleFields) {
        if (!(field in response.style_info)) {
          const error = `프리셋 ${result.presetId}: style_info.${field} 필드 누락`
          console.log(`❌ ${error}`)
          compatibilityErrors.push(error)
          allCompatible = false
        }
      }
    }
  }
  
  if (allCompatible) {
    console.log('✅ 모든 Mock 응답이 ComfyUI 호환 구조를 가집니다')
    console.log('✅ Phase 2에서 설정한 설계 문서 기준 응답 구조 준수 확인')
  } else {
    console.log('❌ 일부 응답에서 호환성 문제 발견')
    compatibilityErrors.forEach(error => console.log(`   - ${error}`))
  }
  
  return allCompatible
}

export async function GET(request: NextRequest) {
  console.log('🧪 Phase 4-1: Mock 응답 구조 검증 시작 (API)')
  console.log('='.repeat(50))
  
  try {
    console.log('📋 Phase 4-1 시작: Mock 응답 구조 검증 (Phase 2 완료 기반)')
    
    // 1. 모든 프리셋 테스트
    const mockResults = await testAllPresets()
    
    // 2. 결과 요약
    console.log('\n📊 Phase 4-1 테스트 결과 요약')
    console.log('='.repeat(40))
    
    const totalTests = mockResults.length
    const successfulTests = mockResults.filter(r => r.success).length
    const validTests = mockResults.filter(r => r.isValid).length
    
    console.log(`총 테스트: ${totalTests}개`)
    console.log(`성공 응답: ${successfulTests}개`)
    console.log(`구조 유효: ${validTests}개`)
    console.log(`성공률: ${Math.round(successfulTests / totalTests * 100)}%`)
    console.log(`유효율: ${Math.round(validTests / totalTests * 100)}%`)
    
    // 3. 호환성 검증
    const isCompatible = validateCompatibility(mockResults)
    
    // 4. 최종 결과
    console.log('\n🎯 Phase 4-1 최종 결과')
    console.log('='.repeat(30))
    
    const isAllSuccess = successfulTests === totalTests && validTests === totalTests && isCompatible
    
    if (isAllSuccess) {
      console.log('✅ Phase 4-1 완료: Mock 응답 구조 검증 성공')
      console.log('✅ 모든 프리셋(8개) 정상 동작 확인')
      console.log('✅ ComfyUI 호환 구조 준수 확인')
      console.log('✅ Phase 2 설계 문서 기준 응답 구조 완전 준수')
    } else {
      console.log('❌ Phase 4-1 실패: 일부 검증에서 문제 발견')
      console.log(`   - 실패한 테스트: ${totalTests - successfulTests}개`)
      console.log(`   - 구조 오류: ${totalTests - validTests}개`)
      console.log(`   - 호환성 문제: ${isCompatible ? '없음' : '있음'}`)
    }
    
    // API 응답 반환
    return NextResponse.json({
      success: isAllSuccess,
      phase: 'Phase 4-1',
      title: 'Mock 응답 구조 검증',
      summary: {
        totalTests,
        successfulTests,
        validTests,
        successRate: Math.round(successfulTests / totalTests * 100),
        validityRate: Math.round(validTests / totalTests * 100),
        isCompatible
      },
      results: mockResults,
      message: isAllSuccess 
        ? 'Mock 응답 구조 검증 완료 - 모든 프리셋 정상 동작 및 ComfyUI 호환성 확인'
        : 'Mock 응답 구조 검증에서 일부 문제 발견 - 상세 결과 확인 필요'
    })
    
  } catch (error) {
    console.error('❌ Phase 4-1 실행 중 오류 발생:', error)
    
    return NextResponse.json({
      success: false,
      phase: 'Phase 4-1',
      title: 'Mock 응답 구조 검증',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      message: 'Phase 4-1 실행 중 예외 발생'
    }, { status: 500 })
  }
}
