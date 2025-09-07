/**
 * 새로운 2단계 API 방식 CategoryAnalyzer 테스트 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { CategoryAnalyzer } from '@/lib/services/category-prompt/CategoryAnalyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context } = body;

    console.log('🚀 새로운 2단계 API 방식 테스트 시작');
    console.log('📝 테스트 메시지:', message);
    console.log('📚 컨텍스트:', context?.recent_messages);

    // 환경 변수 확인
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다');
    }

    // CategoryAnalyzer 인스턴스 생성 (공식 SDK 사용)
    const analyzer = new CategoryAnalyzer();
    
    // 키워드 추출 실행
    const startTime = Date.now();
    const result = await analyzer.extractKeywords(message, context);
    const endTime = Date.now();

    console.log('🎯 추출 결과:', result.extracted_keywords);
    console.log('📊 신뢰도:', result.confidence_scores);
    console.log('⏱️ 처리 시간:', endTime - startTime, 'ms');

    // 성공 여부 판단
    const locationKeyword = result.extracted_keywords.location_environment.toLowerCase();
    const isSuccess = locationKeyword.includes('mountain') || 
                     locationKeyword.includes('hiking') || 
                     locationKeyword.includes('outdoor') ||
                     locationKeyword.includes('trail');

    const testResult = {
      success: true,
      message: "2단계 API 방식 테스트 완료",
      data: {
        original_message: message,
        context_provided: context,
        extracted_keywords: result.extracted_keywords,
        confidence_scores: result.confidence_scores,
        analysis_method: result.analysis_method,
        processing_time_ms: endTime - startTime,
        reasoning: result.reasoning,
        test_evaluation: {
          success: isSuccess,
          reason: isSuccess 
            ? "산/등산/야외 관련 키워드가 정확히 감지됨" 
            : "여전히 실내/기본 키워드로 인식됨",
          detected_location: result.extracted_keywords.location_environment
        }
      }
    };

    return NextResponse.json(testResult);

  } catch (error: any) {
    console.error('❌ 2단계 API 테스트 실패:', error);

    return NextResponse.json({
      success: false,
      message: "테스트 실행 중 오류 발생",
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "2단계 API 방식 CategoryAnalyzer 테스트 엔드포인트",
    description: "POST 요청으로 message와 context를 전송하여 테스트 실행",
    example: {
      message: "*숨을 고르며 중간 휴식 지점 벤치에 앉으며*",
      context: {
        recent_messages: [
          "오늘 한라산 등산 가요!",
          "등산로 입구에서 출발했어요",
          "조금씩 올라가고 있어요"
        ]
      }
    }
  });
}