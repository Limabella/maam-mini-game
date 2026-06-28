# Kimchi Runner Layered Rig Prototype

원본 캐릭터를 리깅용 레이어로 분리한 프로토타입입니다.

## 폴더
- layers_full_canvas: 원본 1024x1024 캔버스 크기를 유지한 레이어 PNG
- layers_trimmed: 투명 영역을 잘라낸 레이어 PNG
- layers_full_canvas_left_facing: 왼쪽 달리기용 좌우 반전 레이어 PNG
- preview: 레이어 합성 확인 이미지와 pivot 확인 이미지

## 핵심 파일
- rig_pivots.json: 레이어별 pivot, parent 구조, 추천 애니메이션 설정
- test_canvas_layer_rig.html: Canvas에서 레이어 합성/왼쪽 이동을 테스트하는 파일

## 주의
이 분리는 자동 마스크 기반 1차 분리입니다.
실제 상용/완성 게임용으로는 Photoshop, Aseprite, Spine, DragonBones 등에서 가장자리와 가려진 부분을 손으로 보정해야 합니다.

특히 단일 이미지에서 가려진 다리/관절 뒷부분은 원래 정보가 없으므로 완벽하게 복원할 수 없습니다.
하지만 이 구조를 시작점으로 삼으면 원본 캐릭터 다리 디자인을 유지하는 러닝 애니메이션을 만들 수 있습니다.
