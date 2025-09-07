/**
 * 분위기/조명 매핑 데이터
 * 한국어 키워드 → 영어 ComfyUI 프롬프트 매핑
 */

export const ATMOSPHERE_MAPPINGS = {
  // 자연광
  '자연광': 'natural daylight, soft window lighting',
  '햇빛': 'natural sunlight, bright sunny illumination',
  '일광': 'natural daylight, bright outdoor lighting',
  '밝은': 'bright natural lighting, well-lit atmosphere',
  '맑은': 'clear bright lighting, crisp natural illumination',
  
  // 황금시간대
  '황금시간': 'golden hour lighting, warm sunset glow',
  '노을': 'sunset golden light, warm evening glow',
  '석양': 'sunset lighting, golden hour atmosphere',
  '일출': 'sunrise lighting, morning golden glow',
  '새벽': 'dawn lighting, soft morning illumination',
  
  // 따뜻한 조명
  '따뜻한': 'warm cozy lighting, comfortable golden illumination',
  '아늑한': 'cozy warm lighting, comfortable intimate atmosphere',
  '포근한': 'warm cozy lighting, comfortable homey atmosphere',
  '부드러운': 'soft diffused lighting, gentle warm illumination',
  '온화한': 'gentle warm lighting, mild comfortable atmosphere',
  
  // 로맨틱/무드
  '로맨틱한': 'romantic mood lighting, soft intimate atmosphere',
  '달콤한': 'sweet romantic lighting, tender mood atmosphere',
  '감성적인': 'emotional mood lighting, atmospheric romantic glow',
  '몽환적인': 'dreamy atmospheric lighting, ethereal mood',
  '신비로운': 'mysterious atmospheric lighting, enigmatic mood',
  
  // 드라마틱
  '드라마틱한': 'dramatic lighting, strong contrast atmosphere',
  '강렬한': 'intense dramatic lighting, powerful contrast',
  '선명한': 'sharp clear lighting, crisp high contrast',
  '대비가강한': 'high contrast lighting, dramatic shadow play',
  '음영': 'shadow play lighting, dramatic chiaroscuro',
  
  // 부드러운/확산
  '부드러운조명': 'soft diffused lighting, gentle illumination',
  '확산된': 'diffused soft lighting, even gentle illumination',
  '은은한': 'subtle soft lighting, gentle atmospheric glow',
  '연한': 'light soft lighting, delicate gentle illumination',
  '희미한': 'dim soft lighting, subtle atmospheric glow',
  
  // 실내 조명
  '실내등': 'indoor lighting, comfortable interior illumination',
  '조명': 'artificial lighting, indoor lamp illumination',
  '백열등': 'warm incandescent lighting, cozy indoor glow',
  '형광등': 'fluorescent lighting, bright indoor illumination',
  'LED': 'LED lighting, modern clean illumination',
  '스탠드': 'table lamp lighting, localized warm glow',
  '간접조명': 'indirect lighting, soft ambient glow',
  
  // 시간대별
  '아침': 'morning lighting, fresh daylight atmosphere',
  '점심': 'midday lighting, bright overhead illumination',
  '오후': 'afternoon lighting, warm slanted sunlight',
  '저녁': 'evening lighting, soft twilight atmosphere',
  '밤': 'nighttime lighting, artificial evening illumination',
  '심야': 'late night lighting, dim atmospheric glow',
  
  // 날씨 관련
  '맑은날': 'clear day lighting, bright sunny atmosphere',
  '흐린날': 'overcast lighting, diffused cloudy atmosphere',
  '비오는날': 'rainy day lighting, moody atmospheric glow',
  '눈오는날': 'snowy lighting, bright winter atmosphere',
  
  // 계절 관련
  '봄': 'spring lighting, fresh bright atmosphere',
  '여름': 'summer lighting, bright warm atmosphere',
  '가을': 'autumn lighting, warm golden atmosphere',
  '겨울': 'winter lighting, crisp cool atmosphere',
  
  // 특수 조명
  '촛불': 'candlelight, warm flickering glow',
  '난로': 'fireplace lighting, warm cozy glow',
  '벽난로': 'fireplace lighting, warm cozy glow',
  '네온': 'neon lighting, colorful urban glow',
  '스포트라이트': 'spotlight, focused dramatic lighting',
  '무대조명': 'stage lighting, theatrical dramatic illumination',
  
  // 색온도
  '차가운': 'cool lighting, blue-toned illumination',
  '시원한': 'cool lighting, blue-toned illumination',
  '웜톤': 'warm-toned lighting, golden cozy illumination',
  '쿨톤': 'cool-toned lighting, blue crisp illumination',
  
  // 강도
  '밝은조명': 'bright lighting, well-illuminated atmosphere',
  '어두운': 'dim lighting, moody dark atmosphere',
  '은은한': 'subtle lighting, gentle soft glow',
  '강한': 'strong lighting, intense bright illumination',
  '약한': 'weak lighting, subtle dim glow',
  
  // 기본값
  'default': 'soft natural lighting, comfortable warm atmosphere'
} as const;

export type AtmosphereKeyword = keyof typeof ATMOSPHERE_MAPPINGS;