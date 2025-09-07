'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Heart, Users, Zap, Home, MessageCircle, Sparkles, User, UserCheck } from 'lucide-react'
import { Concept, SpeechPreset } from '@/types/database'

interface PresetSelectionProps {
  onSelectionComplete: (gender: 'male' | 'female', relationshipType: string, conceptId: string, chatbotName: string) => void
  onBack?: () => void
  disabled?: boolean
}

interface PresetOption {
  id: string
  label: string
  gender: 'male' | 'female'
  relationship: 'lover' | 'friend' | 'some' | 'family'
  description: string
  style?: string
}

const genderIcons = {
  male: User,
  female: UserCheck
}

const genderColors = {
  male: 'text-secondary bg-surface border-border',
  female: 'text-pink-600 bg-pink-50 border-pink-200'
}

const genderLabels = {
  male: '남성',
  female: '여성'
}

const relationshipIcons = {
  lover: Heart,
  friend: Users,
  some: Zap,
  family: Home
}

const relationshipColors = {
  lover: 'text-error bg-surface border-border',
  friend: 'text-secondary bg-surface border-border',
  some: 'text-purple-500 bg-purple-50 border-purple-200',
  family: 'text-success bg-surface border-border'
}

const relationshipLabels = {
  lover: '연인',
  friend: '친구',
  some: '썸',
  family: '가족'
}

export default function PresetSelection({ 
  onSelectionComplete, 
  onBack, 
  disabled = false 
}: PresetSelectionProps) {
  // 4단계 프로세스: 1(성별) → 2(관계) → 3(컨셉) → 4(이름)
  const [step, setStep] = useState(1)
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | ''>('')
  const [selectedRelationship, setSelectedRelationship] = useState<string>('')
  const [selectedConceptId, setSelectedConceptId] = useState<string>('')
  const [chatbotName, setChatbotName] = useState<string>('')
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [speechPresets, setSpeechPresets] = useState<SpeechPreset[]>([])
  const [loading, setLoading] = useState(false)
  const [speechPresetLoading, setSpeechPresetLoading] = useState(false)

  // 컨셉 데이터 로드
  useEffect(() => {
    if (step === 3 && selectedRelationship) {
      fetchConcepts(selectedRelationship)
    }
  }, [step, selectedRelationship])

  // 성별별 말투 데이터 로드 (Phase 3-3)
  useEffect(() => {
    if (selectedGender) {
      fetchSpeechPresets(selectedGender)
    }
  }, [selectedGender])

  const fetchConcepts = async (relationshipType: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/concepts?relationship_type=${relationshipType}`)
      if (response.ok) {
        const data = await response.json()
        setConcepts(data)
      }
    } catch (error) {
      console.error('Failed to fetch concepts:', error)
    } finally {
      setLoading(false)
    }
  }

  // Phase 3-3: 성별별 말투 프리셋 로딩
  const fetchSpeechPresets = async (gender: 'male' | 'female') => {
    setSpeechPresetLoading(true)
    try {
      console.log(`🔄 성별별 말투 로딩 시작: ${gender}`)
      const response = await fetch(`/api/speech-presets/gender/${gender}`)
      if (response.ok) {
        const result = await response.json()
        const data = result.success ? result.data : result
        setSpeechPresets(data)
        console.log(`✅ ${gender} 말투 ${data?.length || 0}개 로딩 완료:`, data?.map((p: SpeechPreset) => p.name) || [])
      } else {
        console.error(`❌ 성별별 말투 로딩 실패 (${response.status}):`, response.statusText)
        // 폴백: 전체 말투 로드
        const fallbackResponse = await fetch('/api/speech-presets')
        if (fallbackResponse.ok) {
          const fallbackResult = await fallbackResponse.json()
          const fallbackData = fallbackResult.success ? fallbackResult.data : fallbackResult
          setSpeechPresets(fallbackData)
          console.log(`🔄 폴백: 전체 말투 ${fallbackData?.length || 0}개 로딩 완료`)
        }
      }
    } catch (error) {
      console.error('Failed to fetch speech presets:', error)
      // 에러 시에도 폴백 시도
      try {
        const fallbackResponse = await fetch('/api/speech-presets')
        if (fallbackResponse.ok) {
          const fallbackResult = await fallbackResponse.json()
          const fallbackData = fallbackResult.success ? fallbackResult.data : fallbackResult
          setSpeechPresets(fallbackData)
          console.log(`🔄 에러 폴백: 전체 말투 ${fallbackData?.length || 0}개 로딩 완료`)
        }
      } catch (fallbackError) {
        console.error('Fallback speech presets fetch failed:', fallbackError)
      }
    } finally {
      setSpeechPresetLoading(false)
    }
  }

  const handleGenderSelect = (gender: 'male' | 'female') => {
    setSelectedGender(gender)
    setStep(2)
  }

  const handleRelationshipSelect = (relationship: string) => {
    setSelectedRelationship(relationship)
    setStep(3)
  }

  const handleConceptSelect = (conceptId: string) => {
    setSelectedConceptId(conceptId)
    setStep(4)
  }

  const handleSubmit = () => {
    if (!selectedGender || !selectedRelationship || !selectedConceptId || !chatbotName.trim()) {
      alert('모든 설정을 완료해주세요.')
      return
    }

    if (chatbotName.length > 20) {
      alert('AI 캐릭터 이름은 20자 이하로 입력해주세요.')
      return
    }

    // 새로운 시그니처: gender, relationshipType, conceptId, chatbotName
    onSelectionComplete(selectedGender, selectedRelationship, selectedConceptId, chatbotName.trim())
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    } else if (onBack) {
      onBack()
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      {[1, 2, 3, 4].map((stepNum) => (
        <div key={stepNum} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            stepNum <= step 
              ? 'bg-warning text-black' 
              : 'bg-surface text-muted'
          }`}>
            {stepNum}
          </div>
          {stepNum < 4 && (
            <div className={`w-12 h-1 mx-2 ${
              stepNum < step ? 'bg-warning' : 'bg-surface'
            }`} />
          )}
        </div>
      ))}
    </div>
  )

  const renderGenderSelection = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">성별 선택</h3>
        <p className="text-sm text-muted">AI 캐릭터의 성별을 선택해주세요</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(genderLabels).map(([key, label]) => {
          const Icon = genderIcons[key as keyof typeof genderIcons]
          return (
            <div
              key={key}
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                genderColors[key as keyof typeof genderColors]
              } hover:scale-105 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disabled && handleGenderSelect(key as 'male' | 'female')}
            >
              <div className="flex flex-col items-center gap-3">
                <Icon className="w-10 h-10" />
                <span className="font-medium text-lg">{label}</span>
                <span className="text-xs text-muted text-center">
                  {key === 'male' ? '남성적인 매력의 AI 캐릭터' : '여성적인 매력의 AI 캐릭터'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-surface border border-border rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-muted mt-0.5" />
          <div className="text-xs text-muted">
            <p className="font-medium">💡 성별 선택 가이드</p>
            <p className="mt-1">
              선택한 성별에 따라 AI 캐릭터의 외모와 대화 스타일이 결정됩니다. 
              원하는 성별을 선택하고 다음 단계로 진행해주세요.
            </p>
            {speechPresets.length > 0 && (
              <p className="mt-2 text-success font-medium">
                📊 {genderLabels[selectedGender as keyof typeof genderLabels] || '성별 미선택'} 전용 말투 {speechPresets.length}개 준비됨
              </p>
            )}
            {speechPresetLoading && (
              <p className="mt-2 text-secondary">
                🔄 성별별 말투 로딩 중...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderRelationshipSelection = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">관계 선택</h3>
        <p className="text-sm text-muted">
          <strong>{genderLabels[selectedGender as keyof typeof genderLabels]}</strong> AI 캐릭터와 어떤 관계를 원하시나요?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(relationshipLabels).map(([key, label]) => {
          const Icon = relationshipIcons[key as keyof typeof relationshipIcons]
          return (
            <div
              key={key}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                relationshipColors[key as keyof typeof relationshipColors]
              } hover:scale-105 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disabled && handleRelationshipSelect(key)}
            >
              <div className="flex flex-col items-center gap-2">
                <Icon className="w-8 h-8" />
                <span className="font-medium">{label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderConceptSelection = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">
          {relationshipLabels[selectedRelationship as keyof typeof relationshipLabels]} 컨셉 선택
        </h3>
        <p className="text-sm text-muted">
          <strong>{genderLabels[selectedGender as keyof typeof genderLabels]}</strong> AI 캐릭터의 성격을 선택해주세요
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-warning mx-auto"></div>
          <p className="text-sm text-muted mt-2">컨셉 정보 로딩 중...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {concepts.map((concept) => (
            <div
              key={concept.id}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                selectedConceptId === concept.id
                  ? 'border-warning bg-surface shadow-md'
                  : 'border-border hover:border-muted bg-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disabled && handleConceptSelect(concept.id)}
            >
              <div className="flex items-start gap-3">
                <MessageCircle className={`w-5 h-5 mt-1 ${
                  selectedConceptId === concept.id ? 'text-warning' : 'text-muted'
                }`} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{concept.name}</div>
                  <div className="text-xs text-muted mt-1">{concept.description}</div>
                </div>
                {selectedConceptId === concept.id && (
                  <div className="w-5 h-5 bg-warning rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg p-3">
        <div className="flex items-start gap-2">
          <MessageCircle className="w-4 h-4 text-secondary mt-0.5" />
          <div className="text-xs text-secondary">
            <p className="font-medium">🎯 성별별 말투 시스템</p>
            <p className="mt-1">
              선택한 성별({genderLabels[selectedGender as keyof typeof genderLabels]})에 맞는 말투가 자동으로 선택됩니다.
              {speechPresets.length > 0 && ` (${speechPresets.length}개 전용 말투 사용 가능)`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNameInput = () => {
    const selectedConcept = concepts.find(c => c.id === selectedConceptId)
    
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">AI 캐릭터 이름</h3>
          <p className="text-sm text-muted">
            <strong>{genderLabels[selectedGender as keyof typeof genderLabels]}</strong> {selectedConcept?.name} 캐릭터의 이름을 지어주세요
          </p>
        </div>

        {/* 선택 요약 */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-sm">
            <p className="font-medium text-foreground mb-2">선택한 설정 요약</p>
            <div className="space-y-1 text-xs text-muted">
              <p>• <strong>성별:</strong> {genderLabels[selectedGender as keyof typeof genderLabels]}</p>
              <p>• <strong>관계:</strong> {relationshipLabels[selectedRelationship as keyof typeof relationshipLabels]}</p>
              <p>• <strong>컨셉:</strong> {selectedConcept?.name}</p>
              <p>• <strong>말투:</strong> {genderLabels[selectedGender as keyof typeof genderLabels]} 전용 ({speechPresets.length}개 사용 가능)</p>
            </div>
          </div>
        </div>

        {/* 캐릭터 이름 입력 */}
        <div className="space-y-2">
          <Label htmlFor="chatbotName" className="text-base font-medium">
            AI 캐릭터 이름 (필수)
          </Label>
          <Input
            id="chatbotName"
            type="text"
            placeholder="예: 민지, 지훈, 소영 등"
            value={chatbotName}
            onChange={(e) => setChatbotName(e.target.value)}
            maxLength={20}
            disabled={disabled}
            className="text-base"
          />
          <div className="flex justify-between text-xs text-muted">
            <span>한글, 영문, 숫자 사용 가능</span>
            <span>{chatbotName.length}/20</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-success mt-0.5" />
            <div className="text-xs text-success">
              <p className="font-medium">🎉 거의 완료!</p>
              <p className="mt-1">
                이름을 입력하고 &quot;캐릭터 생성&quot; 버튼을 누르면 AI 이미지 생성이 시작됩니다. 
                선택한 설정에 맞는 완벽한 AI 캐릭터를 만들어드릴게요!
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">AI 캐릭터 설정</CardTitle>
        <p className="text-sm text-muted text-center">
          4단계로 완벽한 AI 캐릭터를 만들어보세요
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {renderStepIndicator()}
        
        {step === 1 && renderGenderSelection()}
        {step === 2 && renderRelationshipSelection()}
        {step === 3 && renderConceptSelection()}
        {step === 4 && renderNameInput()}

        {/* 액션 버튼 */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={disabled}
            className="flex-1"
          >
            {step === 1 ? '이전 단계' : '이전'}
          </Button>
          
          {step === 4 ? (
            <Button
              onClick={handleSubmit}
              disabled={disabled || !selectedGender || !selectedRelationship || !selectedConceptId || !chatbotName.trim()}
              className="flex-1 bg-warning hover:bg-warning text-black"
            >
              캐릭터 생성
            </Button>
          ) : (
            <Button
              disabled={true}
              className="flex-1 bg-surface text-muted cursor-not-allowed"
            >
              다음 단계
            </Button>
          )}
        </div>

        {/* 도움말 */}
        <div className="text-center">
          <p className="text-xs text-muted">
            💡 <strong>Tip:</strong> 성별과 관계 선택이 AI 캐릭터의 외모와 성격을 결정합니다
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
