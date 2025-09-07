/**
 * 표정/감정 매핑 데이터
 * 한국어 키워드 → 영어 ComfyUI 프롬프트 매핑
 */

export const EXPRESSION_MAPPINGS = {
  // 긍정적 감정
  '행복한': 'happy and joyful expression, bright cheerful smile',
  '기쁜': 'happy and joyful expression, bright cheerful smile',
  '즐거운': 'happy and joyful expression, bright cheerful smile',
  '웃는': 'smiling warmly, genuine happy expression',
  '미소': 'gentle smile, soft pleasant expression',
  '활짝웃는': 'bright wide smile, extremely happy expression',
  '만족한': 'satisfied content expression, pleased demeanor',
  '뿌듯한': 'proud satisfied expression, accomplished feeling',
  '신나는': 'excited energetic expression, enthusiastic demeanor',
  '흥미진진': 'excited interested expression, engaged curious look',
  
  // 사랑/로맨스
  '사랑스러운': 'lovely affectionate expression, tender loving gaze',
  '로맨틱한': 'romantic and tender expression, loving gaze',
  '달콤한': 'sweet romantic expression, affectionate demeanor',
  '애정어린': 'affectionate caring expression, loving tender look',
  '따뜻한': 'warm and caring expression, gentle smile',
  '다정한': 'kind gentle expression, warm caring demeanor',
  '부드러운': 'soft gentle expression, tender mild demeanor',
  '상냥한': 'kind friendly expression, gentle pleasant demeanor',
  
  // 평온/차분
  '평화로운': 'peaceful and serene expression, calm demeanor',
  '고요한': 'serene quiet expression, peaceful calm demeanor',
  '차분한': 'calm composed expression, peaceful demeanor',
  '안정된': 'stable serene expression, composed calm demeanor',
  '편안한': 'comfortable relaxed expression, at ease demeanor',
  '여유로운': 'leisurely relaxed expression, calm confident demeanor',
  '느긋한': 'leisurely calm expression, unhurried peaceful demeanor',
  
  // 신비/매력
  '신비로운': 'mysterious and enigmatic expression, subtle smile',
  '매혹적인': 'captivating alluring expression, enchanting gaze',
  '우아한': 'elegant graceful expression, refined demeanor',
  '고급스러운': 'sophisticated elegant expression, classy demeanor',
  '매력적인': 'charming attractive expression, appealing demeanor',
  '섹시한': 'alluring confident expression, attractive demeanor',
  
  // 순수/귀여움
  '순수한': 'pure innocent expression, naive sweet demeanor',
  '천진난만': 'innocent pure expression, childlike sweet demeanor',
  '귀여운': 'cute adorable expression, charming sweet demeanor',
  '사랑스러운표정': 'lovely adorable expression, endearing sweet demeanor',
  '깜찍한': 'cute playful expression, charming adorable demeanor',
  '앙증맞은': 'cute petite expression, charming small demeanor',
  
  // 자신감/당당함
  '자신감있는': 'confident assured expression, self-assured demeanor',
  '당당한': 'confident bold expression, assured strong demeanor',
  '의연한': 'dignified composed expression, graceful confident demeanor',
  '도도한': 'proud confident expression, dignified aloof demeanor',
  '카리스마': 'charismatic strong expression, commanding presence',
  
  // 집중/진지
  '집중하는': 'focused concentrated expression, attentive demeanor',
  '진지한': 'serious focused expression, earnest concentrated demeanor',
  '사색하는': 'thoughtful contemplative expression, reflective demeanor',
  '생각하는': 'thinking pondering expression, contemplative demeanor',
  '고민하는': 'worried thoughtful expression, concerned contemplative demeanor',
  
  // 놀람/호기심
  '놀란': 'surprised shocked expression, wide-eyed amazement',
  '깜짝놀란': 'startled surprised expression, shocked amazement',
  '호기심': 'curious interested expression, inquisitive demeanor',
  '궁금한': 'curious wondering expression, interested inquisitive demeanor',
  
  // 부끄러움/수줍음
  '부끄러운': 'shy bashful expression, embarrassed demeanor',
  '수줍은': 'shy timid expression, bashful modest demeanor',
  '쑥스러운': 'bashful shy expression, modest embarrassed demeanor',
  '겸손한': 'humble modest expression, unpretentious demeanor',
  
  // 피로/나른함
  '피곤한': 'tired weary expression, exhausted fatigued demeanor',
  '졸린': 'sleepy drowsy expression, tired relaxed demeanor',
  '나른한': 'languid drowsy expression, relaxed sleepy demeanor',
  '여유있는': 'relaxed leisurely expression, comfortable demeanor',
  
  // 기타 감정
  '아련한': 'wistful nostalgic expression, dreamy melancholic demeanor',
  '그리운': 'longing nostalgic expression, wistful yearning demeanor',
  '감동적인': 'moved emotional expression, touched heartfelt demeanor',
  '뭉클한': 'touched emotional expression, moved heartfelt demeanor',
  
  // 기본값
  'default': 'natural pleasant expression, gentle comfortable demeanor'
} as const;

export type ExpressionKeyword = keyof typeof EXPRESSION_MAPPINGS;