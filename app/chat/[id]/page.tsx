'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Send, Heart, Users, Coffee, Home, Loader2, Settings, MessageCircle } from 'lucide-react'
import { ConceptSelector } from '@/components/chat/ConceptSelector'
import { SpeechPresetSelector } from '@/components/chat/SpeechPresetSelector'
import { MessageBubble, TypingIndicator, SentenceGroup } from '@/components/chat/MessageBubble'
import { ChatMessageWithActions } from '@/components/chat/ChatMessageWithActions'
import { DateSeparator } from '@/components/chat/DateSeparator'
import { splitIntoSentences, validateSentences } from '@/lib/messageUtils'
import { RetryButton } from '@/components/chat/RetryButton'
import { useQuota } from '@/hooks/useQuota'

interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
  session_id?: string
  sender_type?: 'user' | 'bot'
  message?: string
  isSentencePart?: boolean
  sentenceIndex?: number
  totalSentences?: number
  metadata?: {
    images?: Array<{
      url: string
      prompt?: any
      generated_at?: string
    }>
  }
}

interface Chatbot {
  id: string
  name: string
  profile_image_url: string
  user_uploaded_image_url: string
  relationship_type: string
  gender: string
  personality_description: string
  speech_preset_id: string | null
  concept_id: string | null
  is_active: boolean
  created_at: string
}

interface Concept {
  id: string
  name: string
  description: string
  prompt_template: string
}

interface SpeechPreset {
  id: string
  name: string
  description: string
  tone: string
  pattern: string
}

interface ChatPageProps {
  params: {
    id: string
  }
}

// 접근성: 사용자가 애니메이션을 비활성화했는지 감지하는 훅
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handler = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handler)
    
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  return prefersReducedMotion
}

function ChatPage({ params }: ChatPageProps) {
  const router = useRouter()
  const [chatbot, setChatbot] = useState<Chatbot | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  
  // Phase 4: 접근성 - 사용자 환경설정 감지
  const prefersReducedMotion = usePrefersReducedMotion()
  
  // 컨셉 및 말투 선택 상태
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null)
  const [selectedSpeechPreset, setSelectedSpeechPreset] = useState<SpeechPreset | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  
  // 에러 처리 상태
  const [lastFailedMessage, setLastFailedMessage] = useState<string>('')
  const [sendRetryCount, setSendRetryCount] = useState(0)
  
  // 스크롤 참조
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // 할당량 훅
  const { quotas } = useQuota()
  
  // 설정값
  const ENABLE_SENTENCE_SPLIT = true
  const SENTENCE_DISPLAY_SPEED = 800
  const SCROLL_DELAY_AFTER_USER = 100
  
  // ✅ Phase 4: 메시지 분할 유틸리티 함수들 (Phase 1~4-5 기능 보존)
  const displaySentencesSequentially = useCallback((aiMessages: ChatMessage[]) => {
    console.log(`🚀 Phase 4: ${aiMessages.length}개 문장 순차 표시 시작`);
    
    aiMessages.forEach((message, index) => {
      setTimeout(() => {
        console.log(`💬 Phase 4: ${index + 1}번째 문장 표시: "${message.content.substring(0, 30)}..."`);
        setMessages(prev => [...prev, message]);
        scrollToBottom();
        
        // 마지막 문장 표시 완료 시 타이핑 해제
        if (index === aiMessages.length - 1) {
          setTimeout(() => {
            setIsTyping(false);
            console.log('✅ Phase 4: 모든 문장 표시 완료, 타이핑 해제');
          }, 100);
        }
      }, index * SENTENCE_DISPLAY_SPEED);
    });
  }, []);
  
  // 스크롤 함수 - 렌더링 완료 후 스크롤 보장
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 300)
  }
  
  // 에러 정리 함수
  const clearError = () => {
    setError('')
    setLastFailedMessage('')
    setSendRetryCount(0)
  }
  
  // 키보드 이벤트 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
  
  // 재시도 함수
  const retryMessage = async () => {
    if (lastFailedMessage && !isSending) {
      setNewMessage(lastFailedMessage)
      clearError()
      // 약간의 지연 후 자동 전송
      setTimeout(() => {
        sendMessage()
      }, 100)
    }
  }
  
  // 이미지 생성 완료 핸들러
  const handleImageGenerated = useCallback((messageId: string, imageUrl: string, promptInfo: any) => {
    console.log('🖼️ 이미지 생성 완료:', {
      messageId,
      imageUrl: imageUrl.substring(0, 50) + '...',
      promptInfo: promptInfo
    });
    
    setMessages(prevMessages => {
      return prevMessages.map(msg => {
        if (msg.id === messageId) {
          const existingImages = msg.metadata?.images || [];
          return {
            ...msg,
            metadata: {
              ...msg.metadata,
              images: [
                ...existingImages,
                {
                  url: imageUrl,
                  prompt: promptInfo,
                  generated_at: new Date().toISOString()
                }
              ]
            }
          };
        }
        return msg;
      });
    });
    
    // 스크롤을 아래로 이동 - 렌더링 완료 대기 시간 증가
    setTimeout(() => {
      scrollToBottom();
    }, 300);
  }, []);
  
  // ✅ Phase 4-6 Step 3: 안전한 구조의 sendMessage 함수
  const sendMessage = async () => {
    if (!newMessage.trim() || !chatbot || !user || !sessionId || isSending) return;
    
    // 할당량 확인
    const chatQuota = quotas.find(q => q.type === 'chat_messages');
    if (!chatQuota || !chatQuota.canUse) {
      alert('오늘의 채팅 할당량을 모두 사용했습니다.');
      return;
    }
    
    setIsSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');
    
    // 사용자 메시지 즉시 UI에 추가
    const userMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      content: messageContent,
      role: 'user',
      created_at: new Date().toISOString(),
      session_id: sessionId
    };
    
    setMessages(prev => [...prev, userMessage]);
    scrollToBottom();
    
    // AI 타이핑 상태 활성화
    setIsTyping(true);
    scrollToBottom();
    
    try {
      // Claude API 호출
      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
      }
      
      const response = await fetch('/api/chat/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: messageContent,
          chatbot_id: chatbot.id,
          session_id: sessionId,
          concept_id: chatbot.concept_id,
          speech_preset_id: chatbot.speech_preset_id,
          gender: chatbot.gender,
          relationship_type: chatbot.relationship_type
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '메시지 전송에 실패했습니다.');
      }
      
      const data = await response.json();
      
      // Phase 4-9 Step 2: 클라이언트 측 응답 길이 모니터링 로그
      console.log(`📏 Phase 4-9: 클라이언트 수신 응답 길이 - ${data.response?.length || 0}자 (목표: 200자 이내)`);
      if (data.response && data.response.length > 250) {
        console.warn('⚠️ Phase 4-9: 클라이언트에서 긴 응답 감지 - 끊김 가능성 체크:', {
          response_length: data.response.length,
          first_50_chars: data.response.substring(0, 50) + '...',
          last_50_chars: '...' + data.response.substring(data.response.length - 50)
        });
      } else if (data.response) {
        console.log('✅ Phase 4-9: 클라이언트 응답 길이 정상 범위 - 끊김 방지 효과 확인');
      }
      
      // 빈 응답 처리
      if (!data.response || data.response.trim() === '') {
        data.response = '죄송해요, 응답을 생성하는데 문제가 있었어요. 다시 말씀해 주세요.';
      }
      
      // ✅ Phase 1~4-5 기능 보존: 문장별 메시지 생성 및 순차 표시
      if (ENABLE_SENTENCE_SPLIT && data.response && data.response.trim().length > 0) {
        try {
          const sentences = splitIntoSentences(data.response);
          const validatedSentences = validateSentences(sentences);
          
          if (validatedSentences && validatedSentences.length > 0) {
            console.log(`🎯 Phase 4: ${data.response.length}자 응답을 ${validatedSentences.length}개 문장으로 분할`);
            
            // 문장별 메시지 객체 생성
            const aiMessages: ChatMessage[] = validatedSentences.map((sentence, index) => ({
              id: `ai-${Date.now()}-${index}`,
              content: sentence,
              role: 'assistant' as const,
              created_at: new Date().toISOString(),
              session_id: sessionId,
              isSentencePart: true,
              sentenceIndex: index,
              totalSentences: validatedSentences.length
            }));
            
            // 순차 표시 호출
            displaySentencesSequentially(aiMessages);
          } else {
            throw new Error('문장 분할 결과가 비어있음');
          }
        } catch (splitError) {
          console.error('문장 분할 실패:', splitError);
          // 분할 실패 시 단일 메시지로 폴백
          const singleMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            content: data.response,
            role: 'assistant',
            created_at: new Date().toISOString(),
            session_id: sessionId
          };
          
          setMessages(prev => [...prev, singleMessage]);
          setIsTyping(false);
        }
      } else {
        // 분할 비활성화 시 단일 메시지로 처리
        const singleMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          content: data.response,
          role: 'assistant',
          created_at: new Date().toISOString(),
          session_id: sessionId
        };
        
        setMessages(prev => [...prev, singleMessage]);
        setIsTyping(false);
      }
      
      // 성공 후 상태 정리
      setError('');
      setLastFailedMessage('');
      setSendRetryCount(0);
      
    } catch (error) {
      console.error('❌ 메시지 전송 실패:', error);
      
      // 사용자 메시지 UI에서 제거
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      setLastFailedMessage(messageContent);
      setSendRetryCount(prev => prev + 1);
      
      const errorMessage = error instanceof Error ? error.message : '메시지 전송에 실패했습니다.';
      setError(errorMessage);
      
    } finally {
      setIsSending(false);
      setIsTyping(false);
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };
  
  // 초기화 및 데이터 로딩
  useEffect(() => {
    async function loadChatData() {
      console.log('📋 초기화: 채팅 데이터 로딩 시작');
      try {
        const supabase = createSupabaseClient();
        
        // 사용자 정보 확인
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/login');
          return;
        }
        
        setUser(session.user);
        
        // 챗봇 정보 로딩 (user_uploaded_image_url 필드 명시적 포함)
        const { data: chatbotData, error: chatbotError } = await supabase
          .from('chatbots')
          .select(`
            id,
            name,
            profile_image_url,
            user_uploaded_image_url,
            relationship_type,
            gender,
            personality_description,
            speech_preset_id,
            concept_id,
            is_active,
            created_at
          `)
          .eq('id', params.id)
          .single();
        
        if (chatbotError || !chatbotData) {
          console.error('❌ 챗봇 로딩 실패:', chatbotError);
          setError('챗봇을 찾을 수 없습니다.');
          setIsLoading(false);
          return;
          }
        
        // 🔍 수정 사항 검증: user_uploaded_image_url 필드 확인
        console.log('✅ 챗봇 데이터 로딩 완료:', {
          id: chatbotData.id,
          name: chatbotData.name,
          has_profile_image_url: !!chatbotData.profile_image_url,
          has_user_uploaded_image_url: !!chatbotData.user_uploaded_image_url,
          user_uploaded_image_url: chatbotData.user_uploaded_image_url ? 
            chatbotData.user_uploaded_image_url.substring(0, 50) + '...' : 'NULL',
          profile_image_url: chatbotData.profile_image_url ? 
            chatbotData.profile_image_url.substring(0, 50) + '...' : 'NULL'
        });
        
        setChatbot(chatbotData);
        
        // ✅ 세션 처리 로직 수정: 기존 세션 조회 후 새 세션 생성
        let currentSessionId = sessionId;
        if (!currentSessionId) {
          // 1단계: 기존 세션 조회
          console.log('🔍 기존 세션 조회 중:', { chatbot_id: params.id, user_id: session.user.id });
          const { data: existingSession, error: findError } = await supabase
            .from('chat_sessions')
            .select('id')
            .eq('chatbot_id', params.id)
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false }) // started_at 대신 created_at 사용
            .limit(1)
            .maybeSingle(); // single() 대신 maybeSingle() 사용하여 결과가 없어도 에러 발생 안함
          
          if (findError) {
            console.error('❌ 기존 세션 조회 실패:', findError);
          }
          
          if (existingSession) {
            // 2단계: 기존 세션 사용
            console.log('✅ 기존 세션 발견:', existingSession.id);
            currentSessionId = existingSession.id;
            setSessionId(currentSessionId);
          } else {
            // 3단계: 새 세션 생성
            console.log('📝 새 세션 생성 중...');
            const { data: sessionData, error: sessionError } = await supabase
              .from('chat_sessions')
              .insert({
                chatbot_id: params.id,
                user_id: session.user.id
                // started_at 제거: 데이터베이스에는 created_at만 존재하고 자동 생성됨
              })
              .select()
              .single();
            
            if (sessionError) {
              console.error('❌ 새 세션 생성 실패:', sessionError);
              setError('채팅 세션을 생성할 수 없습니다.');
              setIsLoading(false);
              return;
            }
            console.log('✅ 새 세션 생성 완료:', sessionData.id);
            currentSessionId = sessionData.id;
            setSessionId(currentSessionId);
            }
            }
        
        // 기존 메시지 로딩
        const { data: messagesData, error: messagesError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', currentSessionId)
          .order('created_at', { ascending: true });
        
        if (messagesError) {
          console.error('❌ 메시지 로딩 실패:', messagesError);
        } else if (messagesData) {
          console.log('📋 메시지 로딩 및 분할 처리 시작:', messagesData.length);
          
          // 메시지 분할 처리
          const processedMessages: ChatMessage[] = [];
          
          messagesData.forEach((msg) => {
            const baseMessage = {
              ...msg,
              role: msg.role as 'user' | 'assistant'
            };
            
            // AI 메시지이면서 분할 기능이 활성화된 경우 분할 처리
            if (msg.role === 'assistant' && ENABLE_SENTENCE_SPLIT && msg.content && msg.content.trim().length > 0) {
              try {
                const sentences = splitIntoSentences(msg.content);
                const validatedSentences = validateSentences(sentences);
                
                if (validatedSentences && validatedSentences.length > 1) {
                  // 여러 문장으로 분할된 경우 각각을 별도 메시지로 생성
                  console.log(`🎯 로딩된 AI 메시지 분할: ${msg.content.length}자 → ${validatedSentences.length}개 문장`);
                  
                  validatedSentences.forEach((sentence, index) => {
                    // 마지막 문장에만 메타데이터(이미지 정보) 전달
                    const messageData = {
                      ...baseMessage,
                      id: `${msg.id}-split-${index}`, // 고유 ID 생성
                      content: sentence,
                      isSentencePart: true,
                      sentenceIndex: index,
                      totalSentences: validatedSentences.length
                    };
                    
                    // 마지막 문장이 아니면 메타데이터 제거
                    if (index < validatedSentences.length - 1) {
                      delete messageData.metadata;
                    }
                    
                    processedMessages.push(messageData);
                  });
                } else {
                  // 분할되지 않은 경우 원본 그대로 사용
                  processedMessages.push(baseMessage);
                }
              } catch (splitError) {
                console.error('메시지 로딩 시 분할 실패:', splitError);
                // 분할 실패 시 원본 메시지 사용
                processedMessages.push(baseMessage);
              }
            } else {
              // 사용자 메시지이거나 분할이 비활성화된 경우 원본 그대로 사용
              processedMessages.push(baseMessage);
            }
          });
          
          console.log('✅ 메시지 분할 처리 완료:', {
            original: messagesData.length,
            processed: processedMessages.length,
            splitCount: processedMessages.filter(m => m.isSentencePart).length,
            withImages: processedMessages.filter(m => m.metadata?.images?.length > 0).length
          });
          
          // 이미지가 있는 메시지 상세 로그
          processedMessages.filter(m => m.metadata?.images?.length > 0).forEach(msg => {
            console.log('📸 이미지가 있는 메시지:', {
              id: msg.id,
              imageCount: msg.metadata.images.length,
              contentPreview: msg.content.substring(0, 30) + '...'
            });
          });
          
          setMessages(processedMessages);
        }
        
        console.log('✅ 초기화 완료');
        
        } catch (error) {
        console.error('❌ 초기화 실패:', error);
        setError('데이터를 불러오는데 실패했습니다.');
        } finally {
        setIsLoading(false);
        }
        };
        
        loadChatData();
        }, [params.id, router]);
        
        // 메시지 추가 시 스크롤 - 렌더링 완료 대기 시간 증가
  useEffect(() => {
    if (messages.length > 0) {
      // 충분한 지연시간으로 렌더링 완료 보장
      setTimeout(() => {
        scrollToBottom();
      }, 300);
    }
  }, [messages]);
  
  // 타이핑 상태 변경 시 스크롤
  useEffect(() => {
    if (isTyping) {
      scrollToBottom();
    }
  }, [isTyping]);
  
  // 로딩 상태 처리
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-foreground text-sm font-medium">로딩 중...</p>
        </div>
      </div>
    );
  }
  
  if (error && !chatbot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-destructive mb-4 text-sm">{error}</p>
            <Button onClick={() => router.push('/dashboard')} className="bg-primary text-inverse hover:bg-primary/90 px-4 py-2 rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 font-medium text-sm">
              대시보드로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!chatbot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted mb-4 text-sm">챗봇을 찾을 수 없습니다.</p>
            <Button onClick={() => router.push('/dashboard')} className="bg-primary text-inverse hover:bg-primary/90 px-4 py-2 rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 font-medium text-sm">
              대시보드로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="bg-surface/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-interactive-hover text-foreground hover:bg-interactive-active p-2 rounded-2xl border border-border shadow-sm hover:shadow-hover transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <div className="w-10 h-10 bg-surface rounded-2xl overflow-hidden">
              {chatbot.profile_image_url ? (
                <img src={chatbot.profile_image_url} alt={chatbot.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-foreground font-bold text-sm">
                  {chatbot.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success border-2 border-background rounded-full"></div>
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">{chatbot.name}</h1>
            <p className="text-xs text-muted capitalize">{chatbot.relationship_type} • 온라인</p>
          </div>
        </div>
      </div>
      
      {/* 메시지 영역 */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10"
        style={{ paddingBottom: '120px' }}
      >
        {/* 빈 상태 */}
        {messages.length === 0 && !isTyping && (
          <div className="text-center py-16">
            <div className="bg-surface rounded-3xl p-8 border border-border shadow-sm max-w-md mx-auto">
              <div className="w-16 h-16 bg-interactive-hover rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border">
                <MessageCircle className="w-8 h-8 text-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {chatbot.name}과의 대화를 시작해보세요
              </h3>
              <p className="text-muted text-sm leading-normal">
                첫 메시지를 보내보세요! ✨
              </p>
            </div>
          </div>
        )}
            
            {/* 메시지 목록 */}
        {messages.map((message) => (
          <ChatMessageWithActions
            key={message.id}
            message={message}
            onImageGenerated={handleImageGenerated}
            chatbotName={chatbot.name}
            chatbotImage={chatbot.profile_image_url}
            className="mb-4"
          />
        ))}
        
        {/* 타이핑 인디케이터 */}
        {isTyping && (
          <TypingIndicator 
            chatbotName={chatbot.name}
            chatbotImage={chatbot.profile_image_url}
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* 입력 영역 */}
      <div className="bg-surface/90 backdrop-blur-md border-t border-border p-4 sticky bottom-0 relative z-10">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <div className="bg-background rounded-2xl p-3 border border-border shadow-sm transition-all duration-300 focus-within:border-primary focus-within:shadow-hover">
              <input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`${chatbot.name}에게 메시지를 보내세요...`}
                disabled={isSending}
                className="w-full bg-transparent text-foreground placeholder-muted border-none outline-none text-sm font-medium resize-none"
              />
            </div>
          </div>
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isSending || (() => {
              const chatQuota = quotas.find(q => q.type === 'chat_messages')
              return !chatQuota || !chatQuota.canUse
            })()}
            className="min-w-button-sm min-h-button-sm bg-primary hover:bg-primary/90 disabled:bg-muted text-inverse rounded-2xl flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-hover disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        
        {/* 할당량 표시 */}
        <div className="flex justify-center mt-4">
          <div className="bg-background rounded-2xl px-4 py-2 border border-border">
            <span className="text-sm text-muted font-medium">
              {(() => {
                const chatQuota = quotas.find(q => q.type === 'chat_messages')
                if (!chatQuota) return '💬 할당량 정보를 불러오는 중...'
                const chatRemaining = chatQuota.limit - chatQuota.used
                const percentage = (chatQuota.used / chatQuota.limit) * 100
                return (
                  <div className="flex flex-row items-center gap-2 sm:gap-3 justify-center flex-wrap">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span>💬</span>
                      <span className="text-foreground text-xs sm:text-sm">
                        <span className="hidden xs:inline">일일 채팅: {chatQuota.used}/{chatQuota.limit}회</span>
                        <span className="xs:hidden">{chatQuota.used}/{chatQuota.limit}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-12 sm:w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm">({chatRemaining}회 남음)</span>
                    </div>
                  </div>
                )
              })()}
            </span>
          </div>
        </div>
      </div>
      
      {/* 에러 표시 */}
      {error && (
        <div className="fixed bottom-20 left-4 right-4 bg-destructive/10 border border-destructive/20 rounded-lg p-4 shadow-lg z-20">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-destructive mb-2">{error}</p>
              {lastFailedMessage && (
                <p className="text-xs text-muted bg-surface px-2 py-1 rounded">
                  실패한 메시지: &quot;{lastFailedMessage.length > 50 ? lastFailedMessage.slice(0, 50) + '...' : lastFailedMessage}&quot;
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {lastFailedMessage && (
                <RetryButton
                  onRetry={retryMessage}
                  disabled={isSending}
                  maxRetries={3}
                  currentRetries={sendRetryCount}
                  size="sm"
                  label="재전송"
                  context={{
                    operation: 'retry_message',
                    chatbotId: chatbot?.id,
                    sessionId: sessionId || undefined
                  }}
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearError()
                  setTimeout(() => {
                    if (inputRef.current) {
                      inputRef.current.focus()
                    }
                  }, 100)
                }}
                className="p-1 h-auto text-destructive hover:text-destructive/80"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatPage
