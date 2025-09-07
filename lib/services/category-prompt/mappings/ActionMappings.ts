/**
 * 행동/포즈 매핑 데이터
 * 한국어 키워드 → 영어 ComfyUI 프롬프트 매핑
 */

export const ACTION_MAPPINGS = {
  // 기본 자세
  '앉아있는': 'sitting comfortably, relaxed sitting posture',
  '앉은': 'sitting comfortably, relaxed sitting posture',
  '서있는': 'standing naturally, confident standing pose',
  '선': 'standing naturally, confident standing pose',
  '누워있는': 'lying down comfortably, relaxed reclining pose',
  '누운': 'lying down comfortably, relaxed reclining pose',
  '기대고': 'leaning comfortably, casual leaning pose',
  '기댄': 'leaning comfortably, casual leaning pose',
  
  // 움직임
  '걷고있는': 'walking gracefully, natural walking movement',
  '걷는': 'walking gracefully, natural walking movement',
  '뛰는': 'running energetically, dynamic running pose',
  '달리는': 'running energetically, dynamic running pose',
  '춤추는': 'dancing gracefully, elegant dance movement',
  '점프': 'jumping joyfully, dynamic jumping pose',
  '뛰어오르는': 'jumping joyfully, dynamic jumping pose',
  
  // 표현 동작
  '웃고있는': 'smiling warmly, happy cheerful expression',
  '웃는': 'smiling warmly, happy cheerful expression',
  '박수': 'clapping hands, celebrating gesture',
  '손흔드는': 'waving hand, friendly greeting gesture',
  '포옹': 'hugging warmly, affectionate embrace',
  '안아주는': 'hugging warmly, affectionate embrace',
  '키스': 'kissing tenderly, romantic loving gesture',
  '뽀뽀': 'kissing tenderly, romantic loving gesture',
  
  // 일상 활동
  '요리하는': 'cooking with care, preparing food lovingly',
  '요리': 'cooking with care, preparing food lovingly',
  '먹는': 'eating deliciously, enjoying meal',
  '마시는': 'drinking comfortably, enjoying beverage',
  '읽는': 'reading peacefully, focused on book',
  '공부하는': 'studying diligently, focused learning',
  '일하는': 'working diligently, focused on task',
  '청소': 'cleaning carefully, household activity',
  '빨래': 'doing laundry, domestic activity',
  '설거지': 'washing dishes, kitchen activity',
  
  // 휴식 활동
  '자는': 'sleeping peacefully, restful slumber pose',
  '잠자는': 'sleeping peacefully, restful slumber pose',
  '휴식': 'resting comfortably, relaxed peaceful pose',
  '쉬는': 'resting comfortably, relaxed peaceful pose',
  '명상': 'meditating calmly, peaceful mindful pose',
  '생각하는': 'thinking deeply, contemplative pose',
  '고민': 'pondering thoughtfully, reflective pose',
  
  // 소셜 활동
  '대화하는': 'conversing naturally, engaging in dialogue',
  '이야기': 'talking animatedly, engaging conversation',
  '전화하는': 'talking on phone, communication gesture',
  '인사': 'greeting politely, respectful bow or wave',
  '악수': 'shaking hands, formal greeting gesture',
  
  // 감정 표현
  '울고있는': 'crying softly, emotional tearful expression',
  '우는': 'crying softly, emotional tearful expression',
  '화난': 'showing anger, frustrated expression',
  '놀란': 'looking surprised, shocked expression',
  '당황한': 'looking confused, bewildered expression',
  '부끄러운': 'looking shy, bashful embarrassed pose',
  '수줍은': 'looking shy, bashful embarrassed pose',
  
  // 스포츠/운동
  '운동하는': 'exercising actively, fitness workout pose',
  '운동': 'exercising actively, fitness workout pose',
  '헬스': 'working out, gym exercise pose',
  '요가': 'doing yoga, peaceful stretching pose',
  '수영': 'swimming gracefully, aquatic sports pose',
  '테니스': 'playing tennis, athletic sports pose',
  '축구': 'playing soccer, dynamic sports action',
  '농구': 'playing basketball, athletic jumping pose',
  
  // 예술/창작
  '그림그리는': 'drawing artistically, creative artistic pose',
  '그림': 'drawing artistically, creative artistic pose',
  '글쓰는': 'writing thoughtfully, focused writing pose',
  '쓰는': 'writing thoughtfully, focused writing pose',
  '음악': 'playing music, musical performance pose',
  '연주': 'playing instrument, musical performance pose',
  '노래': 'singing beautifully, vocal performance pose',
  
  // 관찰/시선
  '바라보는': 'looking intently, focused gaze direction',
  '보는': 'looking naturally, casual observing pose',
  '쳐다보는': 'gazing directly, direct eye contact',
  '응시': 'staring intensely, concentrated gaze',
  '돌아보는': 'looking back, turning head pose',
  
  // 기본값
  'default': 'natural relaxed pose, comfortable body posture'
} as const;

export type ActionKeyword = keyof typeof ACTION_MAPPINGS;