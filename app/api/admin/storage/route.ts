import { NextRequest, NextResponse } from 'next/server'
import { 
  listStorageBuckets, 
  getBucketInfo
} from '@/lib/storage/supabase-storage'

// GET: 버킷 목록 조회 또는 특정 버킷 정보 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bucketId = searchParams.get('bucket')
    const action = searchParams.get('action')

    if (action === 'test' && bucketId === 'images') {
      // images 버킷 테스트 (현재 비활성화됨)
      console.log('images 버킷 업로드 테스트 요청됨 (현재 지원되지 않음)')
      
      return NextResponse.json({
        success: false,
        action: 'test_upload',
        bucket: 'images',
        error: '테스트 업로드 기능이 현재 비활성화되어 있습니다.'
      })
    }

    if (bucketId) {
      // 특정 버킷 정보 조회
      console.log('버킷 정보 조회:', bucketId)
      const result = await getBucketInfo(bucketId)
      
      return NextResponse.json({
        success: result.success,
        bucket: result.bucket,
        error: result.error
      })
    }

    // 전체 버킷 목록 조회
    console.log('전체 버킷 목록 조회')
    const result = await listStorageBuckets()
    
    return NextResponse.json({
      success: result.success,
      buckets: result.buckets,
      error: result.error
    })

  } catch (error) {
    console.error('Storage admin GET 오류:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      }, 
      { status: 500 }
    )
  }
}

// POST: 버킷 생성 또는 폴더 구조 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, bucketConfig } = body

    if (action === 'create_bucket') {
      console.log('버킷 생성 요청됨 (현재 지원되지 않음)')
      
      return NextResponse.json({
        success: false,
        error: '버킷 생성 기능이 현재 비활성화되어 있습니다.'
      })
    }

    if (action === 'create_folders') {
      console.log('기본 폴더 구조 생성 요청됨 (현재 지원되지 않음)')
      
      return NextResponse.json({
        success: false,
        error: '폴더 구조 생성 기능이 현재 비활성화되어 있습니다.'
      })
    }

    if (action === 'setup_images_bucket') {
      console.log('images 버킷 전체 설정 요청됨 (현재 지원되지 않음)')
      
      return NextResponse.json({
        success: false,
        message: 'images 버킷 설정 기능이 현재 비활성화되어 있습니다.'
      })
    }

    return NextResponse.json(
      { 
        success: false,
        error: '지원하지 않는 액션입니다.' 
      }, 
      { status: 400 }
    )

  } catch (error) {
    console.error('Storage admin POST 오류:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      }, 
      { status: 500 }
    )
  }
}
