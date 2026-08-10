# K-Memorial — 큐레이터의 거짓말

[English](README.md)

> 비공개 데모: https://k-memorial-hidden-table.ant-probe.chatgpt.site

K-Memorial은 가상의 AI 미술관을 배경으로 하는 시각 논리 추리 게임입니다.
한국 회화에서 영감을 받은 작품 5점 중 하나는 위작입니다. 플레이어는 계절,
새, 열매, 달빛, 반복되는 인장과 큐레이터의 증언을 비교해 컬렉션에 속할 수
없는 작품을 찾아냅니다.

![큐레이터의 거짓말 대표 이미지](public/og.png)

## 사건 001 — 다섯 번째 인장

- AI로 제작한 작품 5점
- 논리적으로 확정된 위작 1점
- 큐레이터의 진술 5개 중 거짓 1개
- 제한시간 10분
- 단계별 힌트 3개
- 고발 기회 3회
- 배율을 조절할 수 있는 작품 확대 감상

## 게임 방법

1. **Enter the Gallery**를 눌러 사건을 시작합니다.
2. 다섯 작품을 모두 열어 세부 묘사를 확대해 관찰합니다.
3. 붉은 기억의 인장을 세고 새, 달빛과 열매의 관계를 비교합니다.
4. 의심스러운 큐레이터의 진술을 표시합니다.
5. 위작으로 판단한 작품을 선택하고 **Accuse This Work**를 누릅니다.
6. 제한시간 또는 고발 기회가 끝나기 전에 사건을 해결합니다.

## 설계 원칙

AI는 작품과 분위기를 만들고, 증거와 정답은 결정론적인 게임 데이터가
관리합니다. AI가 플레이어의 답을 주관적으로 판정하지 않으므로 모든 사건은
정답이 하나뿐인지 검증할 수 있습니다.

## 기술 스택

- Next.js 16
- React 19
- TypeScript 5
- vinext 및 Vite 8
- 반응형 갤러리, 오버레이와 확대 조작을 위한 CSS
- OpenAI 생성형 이미지 작품
- OpenAI Sites 비공개 호스팅
- Node.js 22 이상

## 로컬 실행

```bash
npm install
npm run dev
```

## 빌드 및 테스트

```bash
npm run build
npm test
```

## 프로젝트 구조

```text
k-memorial/
  app/
    page.tsx
    globals.css
    layout.tsx
  public/
    assets/gallery/
    og.png
  tests/
    rendered-html.test.mjs
```

## 추가 예정

- 조건문, 순서, 홀짝과 자기지시 논리를 사용하는 고난도 사건
- 구조화된 사건 데이터를 기반으로 한 새로운 미술관 컬렉션 생성
- 시각적 추리 노트와 사건 기록
- 공개 전에 제약조건 풀이기로 유일한 정답 검증
- AI 미술 연출을 활용한 커뮤니티 전시 제작 기능
