// 쿼터 데이터 접근 계층
// Single Responsibility Principle: 데이터베이스 접근만 담당

import { SupabaseClient } from '@supabase/supabase-js'
import { QuotaInfo, QuotaType, QuotaError } from '@/types/quota'

/**
 * 쿼터 저장소 인터페이스
 * Interface Segregation Principle: 필요한 메서드만 정의
 */
export interface IQuotaRepository {
  findByUserId(userId: string): Promise<QuotaInfo[]>
  findByUserIdAndType(userId: string, type: QuotaType): Promise<QuotaInfo | null>
  updateQuota(quota: QuotaInfo): Promise<void>
  createQuota(quota: Omit<QuotaInfo, 'id' | 'created_at' | 'updated_at'>): Promise<QuotaInfo>
  deleteQuota(quotaId: string): Promise<void>
  createDefaultQuotasForUser(userId: string): Promise<QuotaInfo[]>
}

/**
 * Supabase 기반 쿼터 저장소 구현
 * 
 * SOLID 원칙 적용:
 * - Single Responsibility: 데이터베이스 CRUD 작업만 담당
 * - Dependency Inversion: 인터페이스에 의존
 * - Open/Closed: 새로운 데이터베이스 구현체 추가 가능
 */
export class QuotaRepository implements IQuotaRepository {
  private readonly tableName = 'user_quotas'

  constructor(private supabase: SupabaseClient) {}

  /**
   * 사용자의 모든 쿼터 조회
   * @param userId 사용자 ID
   * @returns 사용자의 쿼터 목록
   */
  async findByUserId(userId: string): Promise<QuotaInfo[]> {
    try {
      console.log(`[QuotaRepository] 🔍 DEBUGGING: Fetching quotas for user: ${userId}`)
      console.log(`[QuotaRepository] 🔍 Table name: ${this.tableName}`)
      console.log(`[QuotaRepository] 🔍 Supabase client available:`, !!this.supabase)

      // 1. Service Role Key 사용 시 RLS 우회를 위한 raw 쿼리 시도
      console.log(`[QuotaRepository] 🔍 Attempting RLS bypass with service role...`)
      
      try {
        const { data: rawData, error: rawError } = await this.supabase
          .rpc('get_user_quotas_bypass_rls', { target_user_id: userId })

        if (!rawError && rawData && rawData.length > 0) {
          console.log(`[QuotaRepository] ✅ RLS bypass successful, found ${rawData.length} quotas`)
          const quotas = rawData.map((row: any) => this.mapDatabaseRowToQuotaInfo(row))
          return quotas
        }
        
        console.log(`[QuotaRepository] 🔍 RLS bypass returned no data, trying direct query...`)
      } catch (rpcError) {
        console.log(`[QuotaRepository] 🔍 RPC function failed, proceeding with direct query...`, rpcError)
      }

      // 2. 직접 쿼리 실행 (Service Role Key가 있으면 RLS 자동 우회)
      console.log(`[QuotaRepository] 🔍 Executing direct query with service role...`)
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .order('quota_type')

      console.log(`[QuotaRepository] 🔍 Direct query executed. Error:`, error)
      console.log(`[QuotaRepository] 🔍 Direct query result data:`, data)

      // 3. 에러 처리
      if (error) {
        console.error('[QuotaRepository] 🚨 Error fetching quotas:', error)
        throw new QuotaError(
          `Failed to fetch quotas: ${error.message}`,
          'DB_ERROR'
        )
      }

      // 4. 데이터 확인
      if (!data || data.length === 0) {
        console.log(`[QuotaRepository] 🚨 No quotas found for user: ${userId}`)
        return []
      }

      // 5. 데이터베이스 결과를 QuotaInfo 타입으로 변환
      const quotas = data.map(row => {
        console.log(`[QuotaRepository] 🔍 Processing row:`, row)
        return this.mapDatabaseRowToQuotaInfo(row)
      })
      
      console.log(`[QuotaRepository] ✅ Found ${quotas.length} quotas for user: ${userId}`)
      return quotas

    } catch (error) {
      if (error instanceof QuotaError) {
        throw error
      }
      
      console.error('[QuotaRepository] 🚨 Unexpected error in findByUserId:', error)
      throw new QuotaError(
        'Unexpected database error',
        'DB_ERROR'
      )
    }
  }

  /**
   * 사용자의 특정 타입 쿼터 조회
   * @param userId 사용자 ID
   * @param type 쿼터 타입
   * @returns 해당 타입의 쿼터 또는 null
   */
  async findByUserIdAndType(userId: string, type: QuotaType): Promise<QuotaInfo | null> {
    try {
      console.log(`[QuotaRepository] Fetching quota for user: ${userId}, type: ${type}`)

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('quota_type', type)
        .single()

      if (error) {
        // PGRST116는 "no rows found" 에러 - 정상적인 경우
        if (error.code === 'PGRST116') {
          console.log(`[QuotaRepository] No quota found for user: ${userId}, type: ${type}`)
          return null
        }
        
        console.error('[QuotaRepository] Error fetching quota:', error)
        throw new QuotaError(
          `Failed to fetch quota: ${error.message}`,
          'DB_ERROR'
        )
      }

      if (!data) {
        return null
      }

      const quota = this.mapDatabaseRowToQuotaInfo(data)
      console.log(`[QuotaRepository] Found quota for user: ${userId}, type: ${type}`)
      return quota

    } catch (error) {
      if (error instanceof QuotaError) {
        throw error
      }
      
      console.error('[QuotaRepository] Unexpected error in findByUserIdAndType:', error)
      throw new QuotaError(
        'Unexpected database error',
        'DB_ERROR'
      )
    }
  }

  /**
   * 쿼터 정보 업데이트
   * @param quota 업데이트할 쿼터 정보
   */
  async updateQuota(quota: QuotaInfo): Promise<void> {
    try {
      console.log(`[QuotaRepository] 🔍 Updating quota: ${quota.id}, type: ${quota.quota_type}`)
      console.log(`[QuotaRepository] 🔍 Update data:`, {
        id: quota.id,
        used_count: quota.used_count,
        limit_count: quota.limit_count,
        last_reset_at: quota.last_reset_at?.toISOString() || null,
        next_reset_at: quota.next_reset_at?.toISOString() || null
      })
  
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          used_count: quota.used_count,
          limit_count: quota.limit_count,
          last_reset_at: quota.last_reset_at?.toISOString() || null,
          next_reset_at: quota.next_reset_at?.toISOString() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', quota.id)
        .select()
  
      console.log(`[QuotaRepository] 🔍 Update response:`, {
        hasData: !!data,
        dataLength: data?.length || 0,
        error: error,
        data: data
      })
    } catch (error) {
      if (error instanceof QuotaError) {
        throw error
      }
      
      console.error('[QuotaRepository] 🚨 Unexpected error in updateQuota:', error)
      throw new QuotaError(
        'Unexpected database error',
        'DB_ERROR'
      )
    }
  }

  /**
   * 새 쿼터 생성
   * @param quota 생성할 쿼터 정보 (id, created_at, updated_at 제외)
   * @returns 생성된 쿼터 정보
   */
  async createQuota(quota: Omit<QuotaInfo, 'id' | 'created_at' | 'updated_at'>): Promise<QuotaInfo> {
    try {
      console.log(`[QuotaRepository] Creating quota for user: ${quota.user_id}, type: ${quota.quota_type}`)

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert({
          user_id: quota.user_id,
          quota_type: quota.quota_type,
          used_count: quota.used_count,
          limit_count: quota.limit_count,
          last_reset_at: quota.last_reset_at?.toISOString(),
          next_reset_at: quota.next_reset_at?.toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('[QuotaRepository] Error creating quota:', error)
        throw new QuotaError(
          `Failed to create quota: ${error.message}`,
          'DB_ERROR'
        )
      }

      if (!data) {
        throw new QuotaError(
          'No data returned after quota creation',
          'DB_ERROR'
        )
      }

      const createdQuota = this.mapDatabaseRowToQuotaInfo(data)
      console.log(`[QuotaRepository] Successfully created quota: ${createdQuota.id}`)
      return createdQuota

    } catch (error) {
      if (error instanceof QuotaError) {
        throw error
      }
      
      console.error('[QuotaRepository] Unexpected error in createQuota:', error)
      throw new QuotaError(
        'Unexpected database error',
        'DB_ERROR'
      )
    }
  }

  /**
   * 쿼터 삭제
   * @param quotaId 삭제할 쿼터 ID
   */
  async deleteQuota(quotaId: string): Promise<void> {
    try {
      console.log(`[QuotaRepository] Deleting quota: ${quotaId}`)

      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', quotaId)

      if (error) {
        console.error('[QuotaRepository] Error deleting quota:', error)
        throw new QuotaError(
          `Failed to delete quota: ${error.message}`,
          'DB_ERROR'
        )
      }

      console.log(`[QuotaRepository] Successfully deleted quota: ${quotaId}`)

    } catch (error) {
      if (error instanceof QuotaError) {
        throw error
      }
      
      console.error('[QuotaRepository] Unexpected error in deleteQuota:', error)
      throw new QuotaError(
        'Unexpected database error',
        'DB_ERROR'
      )
    }
  }

  /**
   * 사용자를 위한 기본 쿼터들 생성
   * @param userId 사용자 ID
   * @returns 생성된 기본 쿼터들
   */
  async createDefaultQuotasForUser(userId: string): Promise<QuotaInfo[]> {
    console.log(`[QuotaRepository] Creating default quotas for user: ${userId}`)

    const defaultQuotas = [
      {
        user_id: userId,
        quota_type: QuotaType.PROFILE_IMAGE_GENERATION,
        used_count: 0,
        limit_count: 1,
        last_reset_at: null,
        next_reset_at: null
      },
      {
        user_id: userId,
        quota_type: QuotaType.CHAT_MESSAGES,
        used_count: 0,
        limit_count: 50,
        last_reset_at: null,
        next_reset_at: null
      },
      {
        user_id: userId,
        quota_type: QuotaType.CHAT_IMAGE_GENERATION,
        used_count: 0,
        limit_count: 5,
        last_reset_at: null,
        next_reset_at: null
      }
    ]

    const createdQuotas: QuotaInfo[] = []

    for (const quotaData of defaultQuotas) {
      try {
        const created = await this.createQuota(quotaData)
        createdQuotas.push(created)
      } catch (error) {
        console.error(`[QuotaRepository] Failed to create default quota ${quotaData.quota_type}:`, error)
        // 개별 실패는 로그만 남기고 계속 진행
      }
    }

    console.log(`[QuotaRepository] Created ${createdQuotas.length}/3 default quotas for user: ${userId}`)
    return createdQuotas
  }

  /**
   * 데이터베이스 row를 QuotaInfo 객체로 변환
   * @param row 데이터베이스 row 데이터
   * @returns QuotaInfo 객체
   */
  private mapDatabaseRowToQuotaInfo(row: any): QuotaInfo {
    return {
      id: row.id,
      user_id: row.user_id,
      quota_type: row.quota_type as QuotaType,
      used_count: row.used_count,
      limit_count: row.limit_count,
      last_reset_at: row.last_reset_at ? new Date(row.last_reset_at) : null,
      next_reset_at: row.next_reset_at ? new Date(row.next_reset_at) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }
  }

  /**
   * 디버깅용 저장소 상태 정보
   * @param userId 사용자 ID (선택적)
   * @returns 저장소 상태 정보
   */
  async getDebugInfo(userId?: string): Promise<Record<string, any>> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query.limit(10)

      return {
        tableName: this.tableName,
        userId: userId || 'all',
        error: error?.message,
        dataCount: data?.length || 0,
        sampleData: data?.slice(0, 3) || []
      }
    } catch (error) {
      return {
        tableName: this.tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
