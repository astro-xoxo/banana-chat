interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 날짜만 비교 (시간 제거)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    if (dateOnly.getTime() === todayOnly.getTime()) return '오늘';
    if (dateOnly.getTime() === yesterdayOnly.getTime()) return '어제';
    
    // 한국어 날짜 형식
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="flex items-center justify-center my-6">
      <div className="bg-gray-100 text-gray-600 text-xs px-4 py-2 rounded-full border shadow-sm">
        {formatDate(date)}
      </div>
    </div>
  );
}
