// Database 관련 타입
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          profile_image_used: boolean
          daily_chat_count: number
          quota_reset_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          profile_image_used?: boolean
          daily_chat_count?: number
          quota_reset_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          profile_image_used?: boolean
          daily_chat_count?: number
          quota_reset_time?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chatbots: {
        Row: {
          id: string
          user_id: string
          name: string
          profile_image_url: string | null
          relationship_type: string
          gender: string
          concept_id: string | null
          speech_preset_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          profile_image_url?: string | null
          relationship_type: string
          gender: string
          concept_id?: string | null
          speech_preset_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          profile_image_url?: string | null
          relationship_type?: string
          gender?: string
          concept_id?: string | null
          speech_preset_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chatbot_id: string
          content: string
          is_user: boolean
          message_type: string
          created_at: string
        }
        Insert: {
          id?: string
          chatbot_id: string
          content: string
          is_user: boolean
          message_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          chatbot_id?: string
          content?: string
          is_user?: boolean
          message_type?: string
          created_at?: string
        }
      }
      concepts: {
        Row: {
          id: string
          relationship_type: string
          name: string
          description: string | null
          system_prompt: string
          image_prompt_context: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          relationship_type: string
          name: string
          description?: string | null
          system_prompt: string
          image_prompt_context?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          relationship_type?: string
          name?: string
          description?: string | null
          system_prompt?: string
          image_prompt_context?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      speech_presets: {
        Row: {
          id: string
          name: string
          description: string | null
          system_prompt: string
          personality_traits: any | null
          gender: string | null
          gender_prompt: string | null
          base_preset_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          system_prompt: string
          personality_traits?: any | null
          gender?: string | null
          gender_prompt?: string | null
          base_preset_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          system_prompt?: string
          personality_traits?: any | null
          gender?: string | null
          gender_prompt?: string | null
          base_preset_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// 애플리케이션 타입
export type User = Database['public']['Tables']['users']['Row']
export type Chatbot = Database['public']['Tables']['chatbots']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Concept = Database['public']['Tables']['concepts']['Row']
export type SpeechPreset = Database['public']['Tables']['speech_presets']['Row']

// 관계 타입
export type RelationshipType = 'lover' | 'friend' | 'some' | 'family'
export type Gender = 'male' | 'female'
export type MessageType = 'text' | 'image' | 'system'

// 프리셋 매핑
export interface PresetMapping {
  gender: Gender
  relationship: RelationshipType
}

// 쿼터 관련
export interface QuotaInfo {
  profileImageUsed: boolean
  dailyChatCount: number
  chatQuotaResetTime: Date | null
  quotaRemaining: number
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string
}
