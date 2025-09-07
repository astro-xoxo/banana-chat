// 이미지 URL 처리 유틸리티

/**
 * Supabase Storage URL을 공개 접근 가능한 URL로 변환
 */
export function convertToPublicImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl
  
  // 이미 공개 URL 형태라면 그대로 반환
  if (imageUrl.includes('/storage/v1/object/public/')) {
    return imageUrl
  }
  
  // 인증이 필요한 URL을 공개 URL로 변환
  // 예: https://xxx.supabase.co/storage/v1/object/sign/... → https://xxx.supabase.co/storage/v1/object/public/...
  if (imageUrl.includes('/storage/v1/object/sign/')) {
    return imageUrl.replace('/storage/v1/object/sign/', '/storage/v1/object/public/')
  }
  
  // Supabase URL에서 bucket과 파일 경로 추출하여 공개 URL 생성
  try {
    const url = new URL(imageUrl)
    const pathSegments = url.pathname.split('/')
    
    // /storage/v1/object/... 형태 처리
    if (pathSegments.includes('storage')) {
      const storageIndex = pathSegments.indexOf('storage')
      
      if (pathSegments[storageIndex + 3] === 'user-uploads') {
        // user-uploads 버킷의 경우 public 접근 가능하도록 변환
        const bucket = pathSegments[storageIndex + 3]
        const filePath = pathSegments.slice(storageIndex + 4).join('/')
        return `${url.origin}/storage/v1/object/public/${bucket}/${filePath}`
      }
    }
    
    return imageUrl
    
  } catch (error) {
    console.warn('URL 파싱 실패:', error)
    return imageUrl
  }
}

/**
 * 이미지 URL 접근 가능성 검증
 */
export async function validateImageUrlAccessibility(imageUrl: string, timeout = 10000): Promise<boolean> {
  if (!imageUrl) return false
  
  try {
    console.log('이미지 URL 접근성 검증 중:', imageUrl.substring(0, 50) + '...')
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    const response = await fetch(imageUrl, {
      method: 'HEAD', // HEAD 요청으로 헤더만 확인
      signal: controller.signal,
      headers: {
        'User-Agent': 'AI-Face-Chat-ImageValidator/1.0'
      }
    })
    
    clearTimeout(timeoutId)
    
    console.log('이미지 접근성 검증 결과:', {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    })
    
    // 200 응답이고 이미지 컨텐츠 타입인지 확인
    if (response.ok) {
      const contentType = response.headers.get('content-type')
      const isImage = contentType?.startsWith('image/') || false
      
      if (!isImage) {
        console.warn('응답이 이미지 형식이 아님:', contentType)
        return false
      }
      
      return true
    }
    
    console.warn('이미지 URL 접근 실패:', response.status, response.statusText)
    return false
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('이미지 URL 검증 타임아웃:', timeout + 'ms')
    } else {
      console.warn('이미지 URL 검증 중 오류:', error)
    }
    return false
  }
}

/**
 * 이미지 URL 형식 검증
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false
  
  try {
    const urlObj = new URL(url)
    
    // 프로토콜 검증
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false
    }
    
    // Supabase Storage URL 형식 검증
    if (url.includes('.supabase.co')) {
      return url.includes('/storage/v1/object/') && url.includes('user-uploads')
    }
    
    // 일반 이미지 URL 확장자 검증
    const pathname = urlObj.pathname.toLowerCase()
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    
    return imageExtensions.some(ext => pathname.endsWith(ext))
    
  } catch {
    return false
  }
}

/**
 * ComfyUI 서버가 접근 가능한 형태로 이미지 URL 최적화
 */
export function optimizeImageUrlForComfyUI(imageUrl: string): string {
  // 공개 URL로 변환
  const publicUrl = convertToPublicImageUrl(imageUrl)
  
  // URL에서 불필요한 쿼리 파라미터 제거 (ComfyUI 서버에서 문제 일으킬 수 있음)
  try {
    const url = new URL(publicUrl)
    
    // 기본적인 쿼리 파라미터만 유지
    const allowedParams = ['t', 'token'] // 타임스탬프, 토큰만 허용
    const params = new URLSearchParams()
    
    for (const [key, value] of url.searchParams.entries()) {
      if (allowedParams.includes(key)) {
        params.set(key, value)
      }
    }
    
    url.search = params.toString()
    return url.toString()
    
  } catch (error) {
    console.warn('URL 최적화 실패, 원본 반환:', error)
    return publicUrl
  }
}

/**
 * 사용자 업로드 이미지 URL 유효성 검증
 */
export async function validateUserUploadedImageUrl(imageUrl: string): Promise<{
  isValid: boolean;
  error?: string;
  details?: any;
}> {
  try {
    // 1. URL 형식 검증
    if (!imageUrl || typeof imageUrl !== 'string') {
      return { isValid: false, error: 'Invalid URL format' };
    }

    // 2. user-uploads 버킷 URL 검증
    if (!imageUrl.includes('/user-uploads/')) {
      return { 
        isValid: false, 
        error: 'Not a user-uploads bucket URL',
        details: { expected_pattern: '/user-uploads/' }
      };
    }

    // 3. Supabase Storage URL 검증
    const supabaseStoragePattern = /https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/user-uploads\//;
    if (!supabaseStoragePattern.test(imageUrl)) {
      return {
        isValid: false,
        error: 'Invalid Supabase Storage URL format',
        details: { pattern: 'https://[project].supabase.co/storage/v1/object/public/user-uploads/' }
      };
    }

    // 4. 이미지 접근성 확인
    const response = await fetch(imageUrl, { 
      method: 'HEAD',
      timeout: 10000
    });

    if (!response.ok) {
      return {
        isValid: false,
        error: 'Image not accessible',
        details: { status: response.status, statusText: response.statusText }
      };
    }

    // 5. Content-Type 검증
    const contentType = response.headers.get('Content-Type');
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (contentType && !validImageTypes.some(type => contentType.includes(type))) {
      return {
        isValid: false,
        error: 'Invalid image content type',
        details: { contentType, validTypes: validImageTypes }
      };
    }

    return { isValid: true };

  } catch (error) {
    return {
      isValid: false,
      error: 'Image validation failed',
      details: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * 챗봇별 사용자 이미지 조회
 */
export async function getChatbotUserImage(chatbotId: string, supabaseClient: any): Promise<{
  success: boolean;
  imageUrl?: string;
  error?: string;
}> {
  try {
    const { data: chatbot, error } = await supabaseClient
      .from('chatbots')
      .select('user_uploaded_image_url, name')
      .eq('id', chatbotId)
      .single();

    if (error) {
      return { success: false, error: 'Failed to fetch chatbot' };
    }

    if (!chatbot.user_uploaded_image_url) {
      return { 
        success: false, 
        error: `Chatbot "${chatbot.name}" has no uploaded image` 
      };
    }

    return { 
      success: true, 
      imageUrl: chatbot.user_uploaded_image_url 
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}