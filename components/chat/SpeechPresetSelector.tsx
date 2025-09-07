'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, Palette, Volume2, AlertTriangle } from 'lucide-react'
import { SimpleRetryButton } from '@/components/chat/RetryButton'
import { useErrorLogger } from '@/lib/errorLogger'

interface SpeechPreset {
  id: number
  name: string
  description: string
  style_guide: string
  relationship_type?: string
}

interface SpeechPresetSelectorProps {
  relationship_type: string
  selectedPresetId: number | null
  onPresetSelect: (preset: SpeechPreset) => void
  className?: string
}

export function SpeechPresetSelector({ 
  relationship_type, 
  selectedPresetId, 
  onPresetSelect,
  className = ""
}: SpeechPresetSelectorProps) {
  const [presets, setPresets] = useState<SpeechPreset[]>([])
  const [allPresets, setAllPresets] = useState<SpeechPreset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [retryCount, setRetryCount] = useState(0)
  const [showAllPresets, setShowAllPresets] = useState(false)
  const { logUserAction, logError: logErrorToSystem } = useErrorLogger()

  const getUserId = () => 'current_user_id' // 임시값

  // 말투 프리셋 로드 (에러 처리 강화)
  const loadPresets = async () => {
    try {
      setIsLoading(true)
      setError('')
      
      console.log(`말투 프리셋 로드 시작 (${relationship_type}, 재시도: ${retryCount})`)
      
      // 사용자 행동 로깅: 말투 프리셋 로드 시작
      logUserAction('speech_preset_load_start', getUserId(), {
        page: 'speech_preset_selector',
        feature: 'preset_loading'
      }, {
        relationship_type,
        retry_count: retryCount
      })
      
      const response = await fetch('/api/speech-presets')
      
      if (!response.ok) {
        throw new Error(`말투 프리셋 로드 실패: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      const allPresetsData = Array.isArray(data) ? data : (data.speech_presets || [])
      setAllPresets(allPresetsData)
      
      // 관계별 추천 말투 (처음 4개)
      const relationshipPresets = getRecommendedPresets(allPresetsData, relationship_type)
      setPresets(relationshipPresets)
      
      console.log(`말투 프리셋 로드 완료: ${allPresetsData.length}개 (추천: ${relationshipPresets.length}개)`)
      
      // 사용자 행동 로깅: 말투 프리셋 로드 완료
      logUserAction('speech_preset_load_success', getUserId(), {
        page: 'speech_preset_selector',
        feature: 'preset_loading'
      }, {
        relationship_type,
        total_presets: allPresetsData.length,
        recommended_presets: relationshipPresets.length,
        retry_count: retryCount
      })
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '말투 프리셋 로드 중 오류가 발생했습니다'
      console.error('말투 프리셋 로드 오류:', { error, relationship_type, retryCount })
      setError(errorMessage)
      
      // 사용자 행동 로깅: 말투 프리셋 로드 실패
      logErrorToSystem('USER_ACTION', `Speech preset loading failed for user`, error as Error, {
        user_id: getUserId()
      })
      
      logUserAction('speech_preset_load_error', getUserId(), {
        page: 'speech_preset_selector',
        feature: 'preset_loading'
      }, {
        relationship_type,
        error_message: errorMessage,
        retry_count: retryCount
      })
      
    } finally {
      setIsLoading(false)
    }
  }

  // 재시도 핸들러
  const handleRetry = async () => {
    // 사용자 행동 로깅: 재시도 버튼 클릭
    logUserAction('speech_preset_retry_clicked', getUserId(), {
      page: 'speech_preset_selector',
      feature: 'error_recovery'
    }, {
      relationship_type,
      previous_retry_count: retryCount
    })
    
    setRetryCount(prev => prev + 1)
    await loadPresets()
  }

  // 말투 프리셋 선택 핸들러 (로깅 추가)
  const handlePresetSelect = (preset: SpeechPreset) => {
    // 사용자 행동 로깅: 말투 프리셋 선택
    logUserAction('speech_preset_selected', getUserId(), {
      page: 'speech_preset_selector',
      feature: 'preset_selection'
    }, {
      preset_id: preset.id,
      preset_name: preset.name,
      relationship_type,
      previous_preset_id: selectedPresetId,
      is_from_all_presets: showAllPresets
    })
    
    onPresetSelect(preset)
  }

  // 전체/추천 보기 토글 핸들러
  const handleToggleView = () => {
    const newShowAll = !showAllPresets
    
    // 사용자 행동 로깅: 보기 모드 변경
    logUserAction('speech_preset_view_toggled', getUserId(), {
      page: 'speech_preset_selector',
      feature: 'view_toggle'
    }, {
      relationship_type,
      show_all_presets: newShowAll,
      available_presets: newShowAll ? allPresets.length : presets.length
    })
    
    setShowAllPresets(newShowAll)
  }

  // 말투 프리셋 로드
  useEffect(() => {
    loadPresets()
  }, [relationship_type])

  // 관계별 추천 말투 프리셋 (4개씩)
  const getRecommendedPresets = (allPresets: SpeechPreset[], relType: string): SpeechPreset[] => {
    const presetGroups = {
      family: [1, 2, 3, 4],      // 가족 관련 말투
      friend: [5, 6, 7, 8],      // 친구 관련 말투 
      lover: [9, 10, 11, 12],    // 연인 관련 말투
      some: [13, 14, 15, 16]     // 썸 관련 말투
    }
    
    const recommendedIds = presetGroups[relType as keyof typeof presetGroups] || presetGroups.friend
    return allPresets.filter(preset => recommendedIds.includes(preset.id))
  }

  // 말투 프리셋 미리보기 텍스트
  const getPresetPreview = (presetName: string): string => {
    const previews: Record<string, string> = {
      '따뜻한 돌봄 말투': '걱정되는구나... 괜찮아, 내가 있으니까 💙',
      '정겨운 어머니 말투': '얘야, 오늘 하루도 고생 많았다~ 😊',
      '서운한 가족 말투': '아... 좀 섭섭하긴 하지만... 이해해 😔',
      '정중한 전통 말투': '안녕하십니까. 오늘도 좋은 하루 보내세요 🙏',
      
      '신나는 모험 말투': '와! 진짜 재밌겠다!! 같이 가자가자! 🎉',
      '에너지 넘치는 운동 말투': '오늘도 화이팅! 같이 뛰어보자! 💪',
      '친근한 첫만남 말투': '안녕! 반가워~ 앞으로 잘 부탁해! 😄',
      '공감하는 조언 말투': '그럴 수 있어... 너의 마음 이해해 🤗',
      
      '로맨틱한 연인 말투': '당신이 있어서 매일이 특별해요 💕',
      '편안한 애인 말투': '오늘도 수고했어~ 이리 와서 안겨 😊',
      '미안한 연인 말투': '미안해... 정말 미안해. 용서해줄래? 😢',
      '설레는 연인 말투': '너 때문에 심장이 두근두근거려! 💓',
      
      '애매한 썸 말투': '음... 뭔가 이상한데? 너 때문인가? 😏',
      '은근한 밀당 말투': '아~ 그래? 뭔가 재미있는걸? 😉',
      '떨리는 고백 전 말투': '너한테... 할 말이 있어... 😳',
      '호기심 가득한 탐색 말투': '너에 대해 더 알고 싶어져... 🤔'
    }
    
    return previews[presetName] || '안녕하세요~ 😊'
  }

  const displayPresets = showAllPresets ? allPresets : presets

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-purple-500" />
            말투 선택
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 에러 상태 렌더링
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            말투 프리셋 로드 오류
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <SimpleRetryButton
              onRetry={handleRetry}
              disabled={isLoading}
              label="다시 시도"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-purple-500" />
          말투 선택
        </CardTitle>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {showAllPresets ? '모든 말투' : '추천 말투'} ({displayPresets.length}개)
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleView}
            className="text-xs"
          >
            {showAllPresets ? '추천만 보기' : '전체 보기'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {displayPresets.map((preset) => (
            <Button
              key={preset.id}
              variant={selectedPresetId === preset.id ? "default" : "outline"}
              className="h-auto p-4 text-left justify-start"
              onClick={() => handlePresetSelect(preset)}
            >
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    {preset.name}
                  </span>
                  {selectedPresetId === preset.id && (
                    <Badge variant="secondary">선택됨</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {preset.description}
                </p>
                <div className="bg-gray-50 p-2 rounded text-xs italic">
                  📝 &quot;{getPresetPreview(preset.name)}&quot;
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
