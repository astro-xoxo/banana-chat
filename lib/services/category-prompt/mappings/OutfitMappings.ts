/**
 * 의상/스타일 매핑 데이터
 * 한국어 키워드 → 영어 ComfyUI 프롬프트 매핑
 */

export const OUTFIT_MAPPINGS = {
  // 계절별 의상
  '여름옷': 'comfortable summer outfit, light clothing, breathable fabric',
  '여름': 'comfortable summer outfit, light clothing, breathable fabric',
  '겨울옷': 'warm winter clothing, cozy sweater, layered outfit',
  '겨울': 'warm winter clothing, cozy sweater, layered outfit',
  '봄옷': 'spring clothing, light cardigan, comfortable casual wear',
  '봄': 'spring clothing, light cardigan, comfortable casual wear',
  '가을옷': 'autumn clothing, stylish jacket, layered fall fashion',
  '가을': 'autumn clothing, stylish jacket, layered fall fashion',
  
  // 상황별 의상
  '정장': 'formal business attire, professional clothing',
  '비즈니스': 'formal business attire, professional clothing',
  '캐주얼': 'casual everyday wear, relaxed clothing style',
  '편한옷': 'comfortable casual wear, relaxed clothing',
  '운동복': 'athletic wear, sportswear, comfortable workout clothing',
  '스포츠': 'athletic wear, sportswear, comfortable workout clothing',
  '파티': 'party outfit, elegant evening wear, stylish formal clothing',
  '데이트': 'date outfit, stylish romantic clothing, attractive casual wear',
  '여행': 'travel outfit, comfortable practical clothing',
  '홈웨어': 'home wear, comfortable indoor clothing, cozy loungewear',
  '잠옷': 'sleepwear, comfortable nighttime clothing, cozy pajamas',
  '수영복': 'swimwear, beach outfit, summer swimming attire',
  
  // 스타일별
  '모던': 'modern stylish outfit, contemporary fashion, trendy clothing',
  '클래식': 'classic timeless outfit, traditional elegant style',
  '빈티지': 'vintage style clothing, retro fashion, classic vintage outfit',
  '미니멀': 'minimalist outfit, simple clean style, understated fashion',
  '로맨틱': 'romantic style outfit, feminine elegant clothing',
  '캐주얼시크': 'casual chic outfit, effortlessly stylish clothing',
  
  // 색상 관련
  '흰옷': 'white clothing, clean white outfit, pristine white attire',
  '검은옷': 'black clothing, elegant black outfit, sophisticated dark attire',
  '빨간옷': 'red clothing, vibrant red outfit, bold colorful attire',
  '파란옷': 'blue clothing, stylish blue outfit, cool-toned attire',
  '분홍옷': 'pink clothing, feminine pink outfit, soft-colored attire',
  
  // 아이템별
  '드레스': 'beautiful dress, elegant feminine outfit, stylish dress wear',
  '원피스': 'one-piece dress, elegant feminine outfit, stylish dress wear',
  '블라우스': 'stylish blouse, professional shirt, elegant top',
  '셔츠': 'stylish shirt, clean button-up, professional top',
  '티셔츠': 'comfortable t-shirt, casual top, relaxed everyday wear',
  '니트': 'cozy knit sweater, warm comfortable top',
  '스웨터': 'cozy sweater, warm comfortable clothing',
  '재킷': 'stylish jacket, fashionable outer wear, professional blazer',
  '코트': 'elegant coat, sophisticated outerwear, stylish winter coat',
  '청바지': 'denim jeans, casual comfortable pants',
  '치마': 'stylish skirt, feminine bottom wear, elegant skirt outfit',
  '바지': 'comfortable pants, well-fitted trousers, casual bottom wear',
  
  // 액세서리
  '모자': 'with stylish hat, fashionable headwear accessory',
  '안경': 'with glasses, stylish eyewear, intellectual accessory',
  '목걸이': 'with necklace, elegant jewelry accessory',
  '귀걸이': 'with earrings, delicate jewelry accessory',
  '시계': 'with watch, stylish timepiece accessory',
  '가방': 'with stylish bag, fashionable handbag accessory',
  '스카프': 'with scarf, elegant fabric accessory',
  
  // 특수 의상
  '학교': 'school uniform, student outfit, academic attire',
  '교복': 'school uniform, student outfit, academic attire',
  '직장': 'office attire, professional work clothing',
  '의료진': 'medical professional attire, healthcare uniform',
  '요리사': 'chef outfit, culinary professional attire',
  '군복': 'military uniform, official service attire',
  
  // 기본값
  'default': 'stylish casual outfit, comfortable everyday clothing'
} as const;

export type OutfitKeyword = keyof typeof OUTFIT_MAPPINGS;