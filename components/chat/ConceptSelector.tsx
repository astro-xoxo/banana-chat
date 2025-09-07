'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Heart, Users, Coffee, Home, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react'
import { SimpleRetryButton } from '@/components/chat/RetryButton'
import { useErrorLogger } from '@/lib/errorLogger'

interface Concept {
  id: number
  name: string
  description: string
  relationship_type: string
  system_prompt: string
}

interface ConceptSelectorProps {
  relationship_type: string
  selectedConceptId: number | null
  onConceptSelect: (concept: Concept) => void
  className?: string
}

export function ConceptSelector({ 
  relationship_type, 
  selectedConceptId, 
  onConceptSelect,
  className = ""
}: ConceptSelectorProps) {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [retryCount, setRetryCount] = useState(0)
  const { logUserAction, logError: logErrorToSystem } = useErrorLogger()

  // 사용자 세션 정보 가져오기 (간단한 구현)
  const getUserId = () => {
    // 실제 구현에서는 auth context에서 가져올 수 있음
    return 'current_user_id' // 임시값
  }

  // 컨셉 목록 로드 (에러 처리 강화)
  const loadConcepts = async () => {
    try {
      setIsLoading(true)
      setError('')
      
      console.log(`컨셉 로드 시작 (${relationship_type}, 재시도: ${retryCount})`)
      
      // 사용자 행동 로깅: 컨셉 로드 시작
      logUserAction('concept_selector_load_start', getUserId(), {
        page: 'concept_selector',
        feature: 'concept_loading'
      }, {
        relationship_type,
        retry_count: retryCount
      })
      
      const response = await fetch(`/api/concepts?relationship_type=${relationship_type}`)
      
      if (!response.ok) {
        throw new Error(`컨셉 로드 실패: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      const loadedConcepts = Array.isArray(data) ? data : (data.concepts || [])
      
      setConcepts(loadedConcepts)
      console.log(`컨셉 로드 완료: ${loadedConcepts.length}개`)
      
      // 사용자 행동 로깅: 컨셉 로드 완료
      logUserAction('concept_selector_load_success', getUserId(), {
        page: 'concept_selector',
        feature: 'concept_loading'
      }, {
        relationship_type,
        concepts_count: loadedConcepts.length,
        retry_count: retryCount
      })
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '컨셉 로드 중 오류가 발생했습니다'
      console.error('컨셉 로드 오류:', { error, relationship_type, retryCount })
      setError(errorMessage)
      
      // 사용자 행동 로깅: 컨셉 로드 실패
      logErrorToSystem('USER_ACTION', `Concept loading failed for user`, error as Error, {
        user_id: getUserId()
      })
      
      logUserAction('concept_selector_load_error', getUserId(), {
        page: 'concept_selector',
        feature: 'concept_loading'
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
    logUserAction('concept_selector_retry_clicked', getUserId(), {
      page: 'concept_selector',
      feature: 'error_recovery'
    }, {
      relationship_type,
      previous_retry_count: retryCount
    })
    
    setRetryCount(prev => prev + 1)
    await loadConcepts()
  }

  // 컨셉 선택 핸들러 (로깅 추가)
  const handleConceptSelect = (concept: Concept) => {
    // 사용자 행동 로깅: 컨셉 선택
    logUserAction('concept_selected', getUserId(), {
      page: 'concept_selector',
      feature: 'concept_selection'
    }, {
      concept_id: concept.id,
      concept_name: concept.name,
      relationship_type: concept.relationship_type,
      previous_concept_id: selectedConceptId
    })
    
    onConceptSelect(concept)
  }

  useEffect(() => {
    loadConcepts()
  }, [relationship_type])

  // 관계 타입별 아이콘
  const getRelationshipIcon = (type: string) => {
    switch (type) {
      case 'lover': return <Heart className="w-5 h-5 text-red-500" />
      case 'friend': return <Users className="w-5 h-5 text-blue-500" />
      case 'some': return <Coffee className="w-5 h-5 text-orange-500" />
      case 'family': return <Home className="w-5 h-5 text-green-500" />
      default: return <Sparkles className="w-5 h-5 text-purple-500" />
    }
  }

  // 관계 타입 한글 변환
  const getRelationshipLabel = (type: string) => {
    switch (type) {
      case 'lover': return '연인'
      case 'friend': return '친구'
      case 'some': return '썸'
      case 'family': return '가족'
      default: return '기본'
    }
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getRelationshipIcon(relationship_type)}
            {getRelationshipLabel(relationship_type)} 상황 선택
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-lg" />
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
            컨셉 로드 오류
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
          {getRelationshipIcon(relationship_type)}
          {getRelationshipLabel(relationship_type)} 상황 선택
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          어떤 상황에서 대화하고 싶나요? ({concepts.length}개 상황)
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {concepts.map((concept) => (
            <Button
              key={concept.id}
              variant={selectedConceptId === concept.id ? "default" : "outline"}
              className="h-auto p-4 text-left justify-start"
              onClick={() => handleConceptSelect(concept)}
            >
              <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{concept.name}</span>
                  {selectedConceptId === concept.id && (
                    <Badge variant="secondary" className="ml-2">선택됨</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {concept.description}
                </p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
