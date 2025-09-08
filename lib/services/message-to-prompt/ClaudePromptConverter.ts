/**
 * Claude API 기반 메시지→프롬프트 변환 서비스
 * 원본 프로젝트의 로직을 NanoBanana에 맞게 적용
 */

import { ClaudeClient } from '@/lib/claude'
import { getFixedPromptService } from '../prompt-templates/FixedPromptService'
import type { MessageContext } from './types'

interface PromptConversionResult {
  success: boolean
  positive_prompt: string
  negative_prompt: string
  analysis_info: {
    message_type: 'direct' | 'situational' | 'complex' | 'emotional'
    detected_objects: string[]
    detected_emotions: string[]
    detected_actions: string[]
  }
  error?: string
}

export class ClaudePromptConverter {
  private claudeClient: ClaudeClient
  private promptService = getFixedPromptService()

  constructor() {
    this.claudeClient = new ClaudeClient()
  }

  /**
   * 채팅 메시지를 NanoBanana용 이미지 프롬프트로 변환
   */
  async convertMessageToPrompt(
    messageContent: string,
    context: MessageContext
  ): Promise<PromptConversionResult> {
    try {
      console.log('🔍 Claude 프롬프트 변환 시작:', {
        message: messageContent.substring(0, 50) + '...',
        chatbot: context.user_preferences?.name || 'Unknown'
      })

      // 캐릭터 컨텍스트 구성
      const characterContext = this.buildCharacterContext(context)
      
      // Claude API 프롬프트 구성
      const systemPrompt = this.buildSystemPrompt(characterContext)
      const userPrompt = this.buildUserPrompt(messageContent)

      // Claude API 호출 (올바른 메소드 사용)
      const claudeResponse = await this.claudeClient.generateResponse(
        systemPrompt,
        userPrompt,
        {
          model: 'claude-3-haiku-20240307',
          maxTokens: 1000,
          temperature: 0.7
        }
      )
      console.log('✅ Claude 응답 받음:', claudeResponse.substring(0, 100) + '...')

      // 응답 파싱
      const parsedResult = this.parseClaudeResponse(claudeResponse, messageContent)
      
      if (parsedResult.success) {
        // 스프레드시트 고정 프롬프트와 조합
        const finalPrompts = await this.combineWithFixedPrompts(
          parsedResult.positive_prompt,
          parsedResult.negative_prompt,
          context
        );
        
        parsedResult.positive_prompt = finalPrompts.positive;
        parsedResult.negative_prompt = finalPrompts.negative;
      }
      
      return parsedResult

    } catch (error) {
      console.error('❌ Claude 프롬프트 변환 실패:', error)
      
      // 폴백: Claude 간단 모드로 재시도
      return await this.generateFallbackPrompt(messageContent, context)
    }
  }

  /**
   * 캐릭터 컨텍스트 구성
   */
  private buildCharacterContext(context: MessageContext): string {
    const char = context.user_preferences
    const info = context.chatbot_info

    if (!char) return ''

    return `
캐릭터 정보:
- 이름: ${char.name || '알 수 없음'}
- 나이: ${char.age || '알 수 없음'}세
- 성별: ${char.gender || '알 수 없음'}
- 관계: ${char.relationship || '알 수 없음'}
- 성격: ${char.personality || info?.personality || '알 수 없음'}
- 컨셉: ${char.concept || info?.visual_characteristics || '알 수 없음'}
    `.trim()
  }

  /**
   * Claude용 시스템 프롬프트 구성
   */
  private buildSystemPrompt(characterContext: string): string {
    return `당신은 한국어 채팅 메시지를 고품질 이미지 생성용 영어 프롬프트로 변환하는 전문가입니다.

${characterContext}

변환 규칙:
1. 한국어 메시지의 의도와 감정을 정확히 파악
2. NanoBanana(Google Gemini) API에 최적화된 영어 프롬프트 생성
3. 캐릭터 정보를 자연스럽게 반영
4. 고품질 키워드 자동 추가

메시지 분석 패턴:
- 직접적 요청 ("고양이 그려줘"): 명확한 대상 식별
- 상황적 요청 ("기분이 우울해"): 감정 상태 → 분위기 이미지
- 복합적 요청 ("우주에서 춤추는 발레리나"): 장소+인물+행동 조합

품질 키워드 (항상 포함):
- high quality, detailed, professional digital art
- beautiful composition, vibrant colors
- 8k resolution, masterpiece

응답 형식 (JSON):
{
  "analysis": {
    "type": "direct|situational|complex|emotional",
    "objects": ["감지된 객체들"],
    "emotions": ["감지된 감정들"],
    "actions": ["감지된 행동들"]
  },
  "positive_prompt": "영어 이미지 프롬프트",
  "negative_prompt": "제외할 요소들"
}

부적절한 내용 감지 시 안전한 대안 제시.`
  }

  /**
   * 사용자 메시지 프롬프트 구성
   */
  private buildUserPrompt(messageContent: string): string {
    return `다음 채팅 메시지를 이미지 생성 프롬프트로 변환해주세요:

"${messageContent}"

위의 JSON 형식으로 응답해주세요.`
  }

  /**
   * Claude 응답 파싱
   */
  private parseClaudeResponse(
    claudeResponse: string, 
    originalMessage: string
  ): PromptConversionResult {
    try {
      // JSON 추출 시도
      const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSON 형식을 찾을 수 없음')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        success: true,
        positive_prompt: this.optimizePositivePrompt(parsed.positive_prompt),
        negative_prompt: this.optimizeNegativePrompt(parsed.negative_prompt),
        analysis_info: {
          message_type: parsed.analysis?.type || 'direct',
          detected_objects: parsed.analysis?.objects || [],
          detected_emotions: parsed.analysis?.emotions || [],
          detected_actions: parsed.analysis?.actions || []
        }
      }

    } catch (error) {
      console.warn('⚠️ Claude 응답 파싱 실패, 텍스트 분석 시도:', error)
      
      // 텍스트 분석 폴백
      return this.parseTextResponse(claudeResponse, originalMessage)
    }
  }

  /**
   * 텍스트 응답 파싱 (폴백)
   */
  private parseTextResponse(
    claudeResponse: string,
    originalMessage: string
  ): PromptConversionResult {
    // 간단한 텍스트 분석으로 프롬프트 추출
    const lines = claudeResponse.split('\n').filter(line => line.trim())
    const promptLine = lines.find(line => 
      line.includes('prompt') || line.length > 50
    ) || claudeResponse

    return {
      success: true,
      positive_prompt: this.optimizePositivePrompt(promptLine),
      negative_prompt: this.optimizeNegativePrompt(''),
      analysis_info: {
        message_type: 'direct',
        detected_objects: [],
        detected_emotions: [],
        detected_actions: []
      }
    }
  }

  /**
   * Positive 프롬프트 최적화
   */
  private optimizePositivePrompt(basePrompt: string): string {
    // 기본 프롬프트 정리
    let optimized = basePrompt
      .replace(/["']/g, '') // 따옴표 제거
      .replace(/\s+/g, ' ') // 공백 정리
      .trim()

    // 필수 품질 키워드 추가 (중복 방지) - 애니메이션 스타일 방지 강화, 한 명만, 사용자 얼굴 기반
    const qualityKeywords = [
      'single person only',
      'solo', 
      'one person',
      'photorealistic',
      'realistic photography', 
      'real person',
      'high quality',
      'detailed',
      'professional photography',
      'natural lighting',
      'beautiful composition',
      'sharp focus',
      '8k resolution',
      'masterpiece',
      'not animated',
      'not cartoon',
      'maintain facial features from reference image',
      'consistent face structure',
      'same person appearance'
    ]

    qualityKeywords.forEach(keyword => {
      if (!optimized.toLowerCase().includes(keyword.toLowerCase())) {
        optimized += `, ${keyword}`
      }
    })

    return optimized
  }

  /**
   * Negative 프롬프트 최적화
   */
  private optimizeNegativePrompt(baseNegative: string): string {
    const standardNegatives = [
      'multiple people',
      'two people',
      '2girls',
      '2boys', 
      'couple',
      'group',
      'crowd',
      'multiple faces',
      'different person',
      'face swap',
      'anime',
      'cartoon',
      'animated',
      '2d',
      'illustration', 
      'drawing',
      'sketch',
      'manga',
      'stylized',
      'low quality',
      'blurry',
      'distorted',
      'ugly',
      'bad anatomy',
      'extra limbs',
      'deformed',
      'nsfw',
      'inappropriate content'
    ]

    const negatives = baseNegative ? [baseNegative] : []
    negatives.push(...standardNegatives)

    return [...new Set(negatives)].join(', ')
  }

  /**
   * 스프레드시트 고정 프롬프트와 Claude 생성 프롬프트 조합
   */
  private async combineWithFixedPrompts(
    claudePositivePrompt: string,
    claudeNegativePrompt: string,
    context: MessageContext
  ): Promise<{ positive: string; negative: string }> {
    try {
      const char = context.user_preferences;
      const relationshipType = char?.relationship || 'common';
      const gender = char?.gender as 'male' | 'female' || 'female';

      console.log('🔗 하드코딩 고정 프롬프트와 조합 시작:', {
        relationshipType,
        gender,
        claudePromptLength: claudePositivePrompt.length
      });

      // 하드코딩된 고정 프롬프트 가져오기
      const finalPrompts = await this.promptService.buildFinalPrompt(
        claudePositivePrompt,
        relationshipType,
        gender
      );

      // Claude의 negative prompt와 조합
      const combinedNegative = [
        finalPrompts.negative,
        claudeNegativePrompt
      ].filter(Boolean).join(', ');

      console.log('✅ 하드코딩 고정 프롬프트 조합 완료:', {
        finalPositiveLength: finalPrompts.positive.length,
        finalNegativeLength: combinedNegative.length
      });

      return {
        positive: finalPrompts.positive,
        negative: combinedNegative
      };

    } catch (error) {
      console.warn('⚠️ 하드코딩 프롬프트 조합 실패, 원본 사용:', error);
      return {
        positive: claudePositivePrompt,
        negative: claudeNegativePrompt
      };
    }
  }

  /**
   * 폴백 프롬프트 생성 (Claude 재시도 방식)
   */
  private async generateFallbackPrompt(
    messageContent: string,
    context: MessageContext
  ): Promise<PromptConversionResult> {
    console.log('🔄 폴백 프롬프트 생성 중 (Claude 간단 모드)...')

    try {
      // 캐릭터 컨텍스트 구성
      const characterContext = this.buildCharacterContext(context)
      
      // 더 간단한 Claude 프롬프트 구성 (폴백용)
      const simpleFallbackPrompt = `당신은 한국어 메시지를 영어 이미지 프롬프트로 변환하는 전문가입니다.

${characterContext}

다음 메시지를 간단한 영어 이미지 프롬프트로 변환해주세요:
"${messageContent}"

응답 형식:
- 한 줄로 간단한 영어 이미지 설명
- 인물 정보와 상황 포함
- 고품질 키워드 포함`

      // Claude API 호출 (더 낮은 온도와 짧은 토큰으로 안정성 확보)
      const claudeResponse = await this.claudeClient.generateResponse(
        simpleFallbackPrompt,
        `메시지: "${messageContent}"`,
        {
          model: 'claude-3-haiku-20240307',
          maxTokens: 300, // 더 짧게
          temperature: 0.3 // 더 안정적으로
        }
      )

      console.log('✅ Claude 폴백 응답 받음:', claudeResponse.substring(0, 100) + '...')

      // 간단한 텍스트 응답으로 처리
      let cleanPrompt = claudeResponse
        .replace(/[\"']/g, '') // 따옴표 제거
        .replace(/\n.*$/gm, '') // 첫 줄만 사용
        .trim()

      // 캐릭터 정보 추가
      const char = context.user_preferences
      if (char?.gender === 'female') {
        cleanPrompt += `, featuring a beautiful ${char.age || 25}-year-old woman`
      } else if (char?.gender === 'male') {
        cleanPrompt += `, featuring a handsome ${char.age || 25}-year-old man`
      }

      // 하드코딩된 고정 프롬프트와 조합
      const finalPrompts = await this.combineWithFixedPrompts(
        this.optimizePositivePrompt(cleanPrompt),
        this.optimizeNegativePrompt(''),
        context
      );

      return {
        success: true,
        positive_prompt: finalPrompts.positive,
        negative_prompt: finalPrompts.negative,
        analysis_info: {
          message_type: 'direct',
          detected_objects: [],
          detected_emotions: [],
          detected_actions: []
        }
      }

    } catch (fallbackError) {
      console.warn('⚠️ Claude 폴백도 실패, 최종 기본 프롬프트 사용:', fallbackError)
      
      // 최종 폴백: 아주 기본적인 프롬프트
      const char = context.user_preferences
      const basicPrompt = char?.gender === 'female' 
        ? `beautiful ${char.age || 25}-year-old woman, natural expression, soft lighting, high quality`
        : `handsome ${char.age || 25}-year-old man, confident expression, natural lighting, high quality`

      // 최종 폴백에도 하드코딩된 고정 프롬프트 적용
      const finalPrompts = await this.combineWithFixedPrompts(
        this.optimizePositivePrompt(basicPrompt),
        this.optimizeNegativePrompt(''),
        context
      );

      return {
        success: true,
        positive_prompt: finalPrompts.positive,
        negative_prompt: finalPrompts.negative,
        analysis_info: {
          message_type: 'direct',
          detected_objects: [],
          detected_emotions: [],
          detected_actions: []
        }
      }
    }
  }
}