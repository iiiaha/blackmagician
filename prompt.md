# Black Magician — SketchUp Ruby Plugin

## 프로젝트 개요
"Black Magician"은 SketchUp 사용자를 위한 머티리얼 매핑 소스 관리 플러그인이다.
SketchUp에서 루비 아이콘을 클릭하면 팝업창이 열리고,
상단에 **Deck** 탭과 **Library** 탭이 있다.

지금 이 단계에서는 **Ruby 플러그인과 Deck 기능 구현에만 집중**한다.
Library 웹사이트 개발, 구독/결제 기능은 이후 단계에서 진행한다.

---

## 기술 스택
- SketchUp Ruby API (HtmlDialog 기반 팝업)
- UI: HTML / CSS / JavaScript (HtmlDialog 내부 렌더링, Chromium 기반)
- Ruby ↔ JS 통신:
  - JS → Ruby: `window.location = 'sketchup:command?param=value'`
  - Ruby → JS: `dialog.execute_script("fn(#{data.to_json})")`

---

## UI 디자인 원칙
- **라이트 모드** (다크모드 없음)
- **모던 / 심플 / 미니멀** 디자인
- 폰트: 시스템 기본 sans-serif
- 컬러: 흰색 배경, 밝은 회색 보더, 진한 회색 텍스트, 포인트 컬러 블랙
- 불필요한 장식 없이 깔끔하게

---

## 팝업 구조
- 크기: 900×650 (리사이즈 가능)
- 상단: Deck 탭 / Library 탭 전환
- **Deck 탭**: 완전 로컬 UI (아래 상세 명세 참고)
- **Library 탭**: 웹사이트를 iframe으로 로드 (현재는 임시 URL 표시)

---

## 디렉토리 구조
Plugins/
└── black_magician/
├── black_magician.rb          # 진입점 — 메뉴 등록 + 팝업 실행
├── core/
│   ├── dialog.rb              # HtmlDialog 생성 및 콜백 등록
│   ├── scanner.rb             # 로컬 deck 폴더 스캔 → JSON 반환
│   └── material.rb            # SketchUp 머티리얼 등록 로직
└── ui/
├── index.html             # 팝업 진입점 (탭 레이아웃)
├── deck.js                # Deck UI 로직
├── deck.css               # Deck 스타일
└── icons/                 # UI 아이콘 (svg)

로컬 마감재 저장 경로:
Plugins/black_magician/deck/{대분류}/{업체명}/{파일명}.jpg
예) deck/타일/마벨로/white_marble_600x600.jpg
deck/무늬목/이건산업/oak_wood_01.jpg

---

## Deck 기능 명세

### 레이아웃
┌─────────────────────────────────────────────────┐
│  [Deck]  [Library]                              │  ← 상단 탭
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  폴더 트리    │   썸네일 갤러리 (정사각 그리드)      │
│  (좌측)      │   (우측)                          │
│              │                                  │
│──────────────│                                  │
│  프리뷰 영역  │                                  │
│  (좌측 하단) │                                  │
└──────────────┴──────────────────────────────────┘

### 좌측 상단 — 폴더 트리
- `deck/` 폴더를 스캔해서 **자동 생성** (사용자가 수정 불가)
- 구조: 대분류(타일 / 무늬목 / 벽지 등) → 소분류(업체명)
- 폴더 클릭 시 우측 갤러리에 해당 폴더 이미지 표시
- 폴더가 없거나 비어있으면: "Library에서 마감재를 다운로드하세요" 안내 문구 표시

### 우측 — 썸네일 갤러리
- 선택된 폴더의 이미지를 정사각 썸네일 그리드로 표시
- 썸네일 크기: 120×120px, 4열 기준
- 이미지 클릭 시 → 좌측 하단 프리뷰 영역에 표시 + 선택 상태 하이라이트

### 좌측 하단 — 프리뷰 영역
- 선택한 이미지를 **원본 비율 그대로** 표시
  (600×600이면 정사각, 600×1200이면 세로 직사각)
- 이미지 아래 파일명, 크기(px) 표시
- 기능 버튼 (아이콘 + 텍스트):
  - 🔄 **회전**: 클릭할 때마다 90도씩 시계방향 회전, 프리뷰에 실시간 반영
  - 🎨 **색상 조절**: 패널 열림 → Hue / Saturation / Brightness 슬라이더
  - ▦ **줄눈**: 패널 열림 → 줄눈 색상(컬러피커) + 두께(px 슬라이더) + 미리보기
  - 🔀 **믹스**: (Phase 2에서 구현, 현재는 버튼만 표시)
- **Insert 버튼** (하단 고정):
  - 현재 편집 상태(회전, 색상, 줄눈)가 적용된 이미지를 최종 생성
  - SketchUp `materials`에 등록
  - 자동 네이밍: `[md]_대분류_파일명` (예: `[md]_타일_white_marble_001`)
  - 등록 완료 후 토스트 메시지: "머티리얼이 등록되었습니다. 페인트 버킷으로 적용하세요."

---

## 개발 순서

### Phase 1 — 플러그인 기본 구조 + 팝업 UI
1. `black_magician.rb`: SketchUp 메뉴에 "Black Magician" 항목 등록
2. HtmlDialog 팝업 (900×650) 열기
3. `index.html`: Deck / Library 탭 전환 UI (라이트 모드, 미니멀)
4. Library 탭: iframe에 임시 URL (`https://example.com`) 로드
5. Deck 탭: 기본 레이아웃 (폴더트리 영역 / 갤러리 영역 / 프리뷰 영역 분할)

### Phase 2 — Deck 폴더 스캔 + 갤러리
1. `scanner.rb`: `deck/` 폴더 재귀 스캔 → `{대분류, 업체명, 파일목록}` JSON 반환
2. 폴더 트리 렌더링 (클릭 시 갤러리 필터링)
3. 썸네일 갤러리 렌더링 (클릭 시 프리뷰 표시)
4. 빈 상태 UI (deck 폴더 없을 때 안내)

### Phase 3 — 프리뷰 + 편집 기능
1. 프리뷰 영역: 원본 비율 이미지 표시
2. 회전 기능 (Canvas로 실시간 렌더링)
3. 색상 조절 (HSB 슬라이더, Canvas 필터)
4. 줄눈 삽입 (Canvas에 격자 오버레이)

### Phase 4 — Insert + 머티리얼 등록
1. 편집된 이미지를 임시 파일로 저장
2. `material.rb`: SketchUp materials에 등록
3. 자동 네이밍 + 중복 처리
4. 완료 토스트 메시지

---

## 주의사항
- SketchUp 2021 이상 호환
- 플러그인 폴더 경로: `Sketchup.find_support_file("Plugins")` 로 동적으로 가져올 것
- HtmlDialog는 Chromium 기반이므로 Canvas API, CSS Grid, Flexbox 모두 사용 가능
- 이미지 편집(회전/색상/줄눈)은 모두 **Canvas API**로 처리 (외부 라이브러리 없이)
- Insert 후 머티리얼 적용은 사용자가 페인트 버킷으로 직접 칠함 (자동 적용 아님)
- Library 탭 iframe은 현재 임시 URL. 추후 실제 웹사이트 URL로 교체 예정

---

## 첫 번째 작업
**Phase 1**부터 시작해줘.
- `black_magician.rb` 작성 (메뉴 등록 + 팝업 실행)
- `core/dialog.rb` (HtmlDialog 900×650 설정)
- `ui/index.html` (라이트 모드, 미니멀, Deck/Library 탭 전환)
- Library 탭: iframe에 임시 URL 로드
- Deck 탭: 3분할 레이아웃 (폴더트리 / 갤러리 / 프리뷰) — 데이터 없이 레이아웃만