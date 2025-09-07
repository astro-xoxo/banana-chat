import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ProfileThumbnailProps {
  imageUrl: string
  alt: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showBorder?: boolean
}

const ProfileThumbnail = ({ 
  imageUrl, 
  alt, 
  size = 'lg', 
  className,
  showBorder = true 
}: ProfileThumbnailProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const sizeClasses = {
    sm: 'w-12 h-12 sm:w-16 sm:h-16',
    md: 'w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24',
    lg: 'w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32'
  }

  const borderClasses = showBorder 
    ? 'border-4 border-green-500 shadow-lg' 
    : ''

  if (hasError) {
    return (
      <div className={cn(
        'bg-gray-100 rounded-full flex items-center justify-center',
        sizeClasses[size],
        'border-4 border-gray-300',
        className
      )}>
        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      </div>
    )
  }

  return (
    <div className={cn('relative', sizeClasses[size], className)}>
      {/* 로딩 스켈레톤 */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 rounded-full animate-pulse" />
      )}
      
      {/* 실제 이미지 */}
      <Image
        src={imageUrl}
        alt={alt}
        fill
        sizes="(max-width: 640px) 80px, (max-width: 1024px) 96px, 128px"
        className={cn(
          'rounded-full object-cover transition-all duration-500',
          borderClasses,
          isLoading ? 'opacity-0' : 'opacity-100 animate-fadeInScale'
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
        priority
      />
    </div>
  )
}

export default ProfileThumbnail
