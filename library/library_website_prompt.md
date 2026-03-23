# Black Magician Library — 웹사이트 개발 프로젝트

## 프로젝트 개요
"Black Magician"은 SketchUp용 마감재 매핑 플러그인이다.
이 웹사이트는 플러그인 내 **Library 탭**에서 iframe으로 로드되는 마감재 라이브러리 서비스다.
사용자는 이 웹사이트에서 마감재(타일, 무늬목, 벽지 등) 이미지를 브라우징하고 다운로드한다.

---

## 도메인 구조

하나의 앱, 라우트로 분리:
- `/` — Library (사용자용, 마감재 브라우징 + 다운로드)
- `/vendor` — 벤더 포털 (업체 로그인 → 제품 등록/관리)
- `/admin` — 관리자 (벤더 승인, 폴더구조 생성)

---

## 기술 스택

| 영역 | 선택 | 근거 |
|------|------|------|
| **프론트엔드** | React (Vite) + TypeScript | iframe SPA에 최적, Cloudflare Pages 호환 |
| **UI** | Tailwind CSS + shadcn/ui | 미니멀 라이트 테마 |
| **백엔드/DB** | Supabase (PostgreSQL) | Auth, Storage, RLS 통합 |
| **인증** | Supabase Auth | Google, Naver, Kakao 소셜 + 이메일 |
| **스토리지** | Supabase Storage | 이미지 저장 + 자동 리사이징 |
| **배포** | Cloudflare Pages | 글로벌 CDN, 빠른 배포 |

---

## 핵심 기능

### 1. 마감재 브라우징 (Library `/`)
- 카테고리별 마감재 목록 (타일 / 무늬목 / 벽지 등)
- 업체(벤더)별 필터링
- 크기별 필터링 (600x600, 300x1200 등)
- 검색 기능
- 각 마감재는 대표 썸네일 + 상세 정보(업체명, 크기, 패턴 수)
- 제품 상세: 재고, 단가, 비고, LT, MOQ 정보 표시
- **브라우징은 비로그인으로 가능, 다운로드는 로그인 필요**

### 2. 마감재 다운로드
- 사용자가 마감재를 선택하고 "다운로드" 클릭
- 다운로드 시 **iframe `postMessage`**로 부모 창(SketchUp 플러그인)에 메시지 전송
- 메시지 규격 (이 규격은 반드시 지켜야 함):
```javascript
window.parent.postMessage({
  type: 'bm-download',
  payload: {
    category: '타일',           // 대분류
    vendor: '마벨로',            // 업체명
    size: '600x600x10',         // 크기 (폴더명으로 사용됨)
    tile: 'white marble',       // 제품명 (폴더명으로 사용됨)
    files: [                    // 다운로드할 이미지 URL 목록
      { name: '001.jpg', url: 'https://cdn.example.com/tiles/001.jpg' },
      { name: '002.jpg', url: 'https://cdn.example.com/tiles/002.jpg' }
    ]
  }
}, '*');
```
- 플러그인 쪽에서 이 메시지를 받아 Ruby로 전달 → 로컬 deck 폴더에 저장하는 로직은 별도 처리됨 (이 프로젝트 범위 아님)

### 3. 다운로드 제한 (구독 기반)
- **무료 계정**: 하루 3개 마감재 다운로드
- **유료 계정**: 무제한 다운로드
- 구독 결제 시스템은 추후 구현 (Phase 4)

### 4. 사용자 인증 (Library 사용자)
- 소셜 로그인: Google, Naver, Kakao
- 이메일/비밀번호 가입
- 브라우징은 비로그인 가능, 다운로드는 로그인 필수

### 5. 벤더 포털 (`/vendor`)
- 업체 회원가입 (필수: 업체명, 담당자명, 담당자 연락처)
- **업체당 계정 하나만 허용**
- 관리자 승인 후 로그인 가능
- 로그인 후:
  - 관리자가 만들어둔 폴더구조 확인
  - 최하위 레벨에 **제품 폴더 생성** (제품명으로)
  - 제품 폴더 안에 **이미지 업로드** (JPG, PNG만 허용)
  - 제품별 메타데이터 입력: 재고, 단가, 비고, LT(리드타임), MOQ
  - 제품 삭제/수정

### 6. 관리자 (`/admin`)
- 벤더 가입 승인/거절
- **벤더별 폴더구조 생성** (최하위 레벨 직전까지)
  - 카테고리마다 폴더 계층이 다를 수 있음
  - 예) 타일: `크기 > 제품` / 원목마루: `시리즈명 > 제품`
  - 벤더는 이 구조 수정 불가
- 전체 제품/이미지 관리

---

## 폴더구조 개념

```
벤더(마벨로)/
  타일/
    600x600/              ← 관리자가 생성 (수정 불가)
      white marble/       ← 벤더가 생성 (제품 폴더)
        001.jpg           ← 벤더가 업로드
        002.jpg
    300x1200/             ← 관리자가 생성
      grey stone/         ← 벤더가 생성
        001.jpg

벤더(대림바닥재)/
  원목마루/
    오크 시리즈/            ← 관리자가 생성
      내추럴 오크/          ← 벤더가 생성 (제품 폴더)
        001.jpg
```

- 관리자: 카테고리 ~ 제품 직전 레벨까지 생성
- 벤더: 최하위 폴더(= 제품)만 생성 + 이미지 업로드
- 벤더는 관리자가 만든 폴더 수정/삭제 불가

---

## 이미지 업로드 규칙
- **허용 포맷**: JPG, PNG만 (그 외 차단)
- **자동 리사이징**: 장변 기준 최대 2048px, 파일 크기 5MB 초과 시 압축
- 원본 비율 유지
- SketchUp 매핑 소스 용도이므로 적절한 해상도 유지

---

## DB 스키마 (Supabase PostgreSQL)

### vendors (벤더 계정)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| auth_user_id | uuid FK → auth.users | Supabase Auth 연동 |
| company_name | text NOT NULL | 업체명 |
| contact_name | text NOT NULL | 담당자명 |
| contact_phone | text NOT NULL | 담당자 연락처 |
| approved | boolean DEFAULT false | 관리자 승인 여부 |
| created_at | timestamptz | |

### folder_nodes (폴더 트리 — 관리자가 생성)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| vendor_id | uuid FK → vendors | |
| parent_id | uuid FK → folder_nodes (nullable) | null = 루트(카테고리) |
| name | text NOT NULL | 폴더명 |
| depth | int | 0 = 카테고리, 1, 2... |
| is_leaf | boolean DEFAULT false | true = 여기 아래에 제품 생성 가능 |
| sort_order | int DEFAULT 0 | |
| created_at | timestamptz | |

### products (제품 — 벤더가 생성하는 최하위 폴더)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| vendor_id | uuid FK → vendors | |
| folder_id | uuid FK → folder_nodes | 부모 폴더 (is_leaf=true인 폴더) |
| name | text NOT NULL | 제품명 |
| stock | int | 재고 |
| unit_price | numeric | 단가 |
| lead_time | text | 리드타임 |
| moq | int | 최소주문수량 |
| notes | text | 비고 |
| thumbnail_url | text | 대표 이미지 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### product_images (제품 이미지)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| product_id | uuid FK → products | |
| file_name | text | 001.jpg |
| storage_path | text | Supabase Storage 경로 |
| url | text | 공개 URL |
| sort_order | int DEFAULT 0 | |
| created_at | timestamptz | |

### user_profiles (Library 사용자)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| auth_user_id | uuid FK → auth.users | Supabase Auth 연동 |
| display_name | text | |
| plan | text DEFAULT 'free' | 'free' / 'premium' |
| plan_expires_at | timestamptz | |
| created_at | timestamptz | |

### download_logs (다운로드 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → user_profiles | |
| product_id | uuid FK → products | |
| downloaded_at | timestamptz DEFAULT now() | |

---

## UI 디자인 원칙
- **라이트 모드** (다크모드 없음)
- **모던 / 심플 / 미니멀** — 플러그인 UI와 톤 일치
- 흰색 배경, 밝은 회색 보더, 진한 회색 텍스트, 포인트 컬러 블랙
- SketchUp HtmlDialog iframe 내에서 900x650 공간에 표시됨을 고려
- 불필요한 장식 없이 깔끔하게

---

## 중요 제약 사항
- 이 웹사이트는 **SketchUp 플러그인의 iframe 안에서 로드**됨
  - HtmlDialog는 Chromium 기반 (모던 브라우저 호환)
  - iframe 내에서 동작해야 하므로 X-Frame-Options 주의
  - 외부 팝업/리다이렉트 최소화 (결제 등 불가피한 경우 제외)
- 다운로드는 실제 파일 다운로드가 아님 — `postMessage`로 URL을 전달하면 플러그인이 처리
- `postMessage` 규격 (위에 명시)은 반드시 준수

---

## 개발 순서

### Phase 1 — 프로젝트 세팅 + 벤더 포털 기본
1. Vite + React + TypeScript + Tailwind + shadcn/ui 프로젝트 세팅
2. Supabase 프로젝트 생성 + DB 스키마 마이그레이션
3. React Router 설정 (`/`, `/vendor`, `/admin`)
4. 벤더 회원가입/로그인 UI
5. 관리자 벤더 승인 UI

### Phase 2 — 폴더구조 + 제품 관리
1. 관리자: 벤더별 폴더구조 CRUD
2. 벤더: 폴더 트리 뷰 (읽기 전용)
3. 벤더: 제품 폴더 생성 (최하위)
4. 벤더: 이미지 업로드 (리사이징 + 포맷 검증)
5. 벤더: 제품 메타데이터 입력 (재고, 단가, 비고, LT, MOQ)

### Phase 3 — Library 프론트엔드
1. 마감재 브라우징 UI (카테고리/벤더/크기 필터)
2. 검색 기능
3. 제품 상세 모달 (이미지 갤러리 + 메타 정보)
4. 사용자 로그인 (Google, Naver, Kakao, 이메일)
5. 다운로드 + postMessage 연동
6. 다운로드 제한 (무료 3개/일, 유료 무제한)

### Phase 4 — 구독 결제 (추후)
1. 결제 시스템 연동 (토스페이먼츠)
2. 구독 관리 UI

---

## 참고: 플러그인 쪽 폴더 구조
다운로드된 파일이 저장되는 로컬 구조:
```
deck/
  대분류/
    업체명/
      크기/
        제품명/
          001.jpg
          002.jpg
          003.jpg
```
예시:
```
deck/타일/마벨로/600x600x10/white marble/001.jpg
deck/무늬목/이건산업/300x1200/oak wood/001.jpg
```

이 구조를 웹사이트의 마감재 데이터 구조와 일치시켜야 함.
