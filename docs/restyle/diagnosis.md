# 리스타일 v3.2 — 진단과 방향 (수정 전 기록)

> 가이드 `docs/external-tools-guide.md` 3장 A-2 **경우 2(전체 리스타일)** 순서로 진행한다.
> 적용 범위: `restyle/v3.2` 브랜치만. main·빌드에는 반영하지 않고, 사용자가 항목별로 고른 뒤 반영한다.

## 1. 진단 (수정 없음)

### 1-1. web-design-guidelines (Vercel Web Interface Guidelines, 2026-11-01 최신 규칙)

```text
## web/src/ui/app.css
web/src/ui/app.css:1   - :focus-visible 스타일 없음 (키보드·리모컨 포커스가 안 보임)
web/src/ui/app.css:83  - 움직임(blink·floatup·flash·intro)에 prefers-reduced-motion 대체 없음
web/src/ui/app.css:98  - 무한 반복 깜빡임(.blink·.glow) — 움직임 줄이기 설정에서 멈춰야 함
web/src/ui/app.css:127 - .hpbar > i 가 width 를 애니메이션 (transform/opacity만 권장)
web/src/ui/app.css:16  - color-scheme: dark 없음 (스크롤바·입력창이 밝게 그려질 수 있음)
web/src/ui/app.css:24  - button 에 hover·active 상태 없음 (눌렀을 때 반응이 없음)
web/src/ui/app.css:34  - 비활성 버튼이 opacity 하나로만 구분됨
web/src/ui/app.css:24  - touch-action: manipulation 없음 (두 번 탭 확대 지연)
web/src/ui/app.css:77  - .modal 에 overscroll-behavior: contain 없음
web/src/ui/app.css     - 숫자(골드·HP·가격)에 tabular-nums 없음 → 값이 바뀔 때 글자 폭이 흔들림

## web/index.html
web/index.html:5 - user-scalable=no (확대 금지) — 게임 앱이라 의도된 값, 유지
web/index.html:6 - theme-color #14161C ≠ 페이지 배경 #0F1115

## web/src/ui/chrome.ts
web/src/ui/chrome.ts:30 - 설정(톱니) 아이콘 버튼에 aria-label 없음
web/src/ui/chrome.ts:50 - 하단 메뉴 아이콘 버튼 4개에 aria-label 없음

## web/src/ui/overlay.ts
web/src/ui/overlay.ts:45 - 토스트(알림)에 aria-live="polite" 없음

## web/src/screens/battle.ts · dungeon.ts · guild.ts
battle.ts:337, battle.ts:541, dungeon.ts:306, guild.ts:85 - div role=button: 키보드(Enter/Space) 처리·tabindex 없음
```

### 1-2. hallmark audit (restyle 깊이 · app 범위 · sloplint)

`sloplint: 19 FAIL, 23 REFLEX, 3 WARN` — 브라우저 렌더 검사는 이 환경에 puppeteer-core 가 없어 정적 검사만.

| 등급 | 게이트 | 내용 |
|---|---|---|
| FAIL | 10a | `.hpbar > i` width 전환 |
| FAIL | 26a | `:focus-visible` 없음 |
| FAIL | 27 | 움직임에 reduced-motion 대체 없음 |
| FAIL | 39a | 비활성을 opacity 하나로만 표시 |
| FAIL ×15 | 48 | 색·글꼴 값이 토큰 밖에 직접 적힘 (app.css + 화면 코드 곳곳) |
| REFLEX ×22 | 24b | 4px 간격 체계 밖 값 (14·10·6px 등) |
| REFLEX | 26b | `:active` 없음 |
| WARN ×3 | 41 | 어두운 카드가 글자색을 직접 정하지 않음 |

**화면을 먼저 본 판단 (4줄)**
- **용도**: 던전에 도전할 모험가를 키우는 모바일 게임. 한 화면에서 빠르게 고르고(이동·전투·거래) 마을에서 성장시킨다.
- **잘 된 것·유지**: 한 화면 배치(마을·캐릭터·전투)와 정보 밀도, 색으로 구분하는 방향키(금색 새 방·초록 귀환·빨강 보스), 일러스트 + 대사 상자.
- **생성된 티**: 무채색에 가까운 검정 바탕 + 금색 하나(가장 흔한 기본값), 모든 것이 같은 둥근 카드·같은 반경, 눌러도 반응 없는 버튼, 글꼴 하나로만 위계를 표현.
- **고장**: 키보드 포커스가 안 보임, 움직임 줄이기 미지원, 비활성 표현이 약함.

### 1-3. ui-ux-pro-max 검색

- `--design-system "mobile game dark fantasy rpg dungeon"` → 랜딩 페이지용(영웅+기능+CTA)·Swiss 스타일이 나와 **맞지 않음**. 한 번 좁혀 다시 찾았으나(`game rpg fantasy` 색, `fantasy game medieval` 글꼴) 게임 RPG에 맞는 팔레트·한글 글꼴은 **검증된 결과 없음**.
- 그래서 팔레트·글꼴은 아래 frontend-design 방향으로 정하고, ui-ux-pro-max 는 **점검 규칙**(대비 4.5:1, 터치 44px·간격 8px, 눌림 피드백, 다크 모드 대비, 상태 레이어)만 쓴다.

## 2. 방향 (frontend-design · 2단계)

- **주제**: 한국어 모바일 던전 육성 게임. 플레이어는 짧게 자주 들어와 방을 고르고 전투한다.
- **브랜드에서 출발**: 새 앱 아이콘(밤하늘 남색 돌 + 횃불 호박빛 + 양피지색 모험가)을 브랜드로 본다.
- **한 줄 컨셉**: *횃불이 비추는 석실* — 바탕은 차가운 밤색 돌, 손이 닿는 곳(주요 버튼·선택)만 횃불빛.

| 이름 | 값 | 쓰임 |
|---|---|---|
| 밤돌 | `#0E1521` | 화면 바탕 |
| 석판 | `#152030` | 카드 |
| 이음돌 | `#2A374B` | 테두리 |
| 양피지 | `#F1E8D6` | 글자 |
| 횃불 | `#F0A23B` | 주요 버튼·선택 강조 |
| 잉걸 | `#E06B4E` | 위험·패배 (기존 빨강 유지) |

- **글꼴**: 본문은 Pretendard 그대로. 화면 제목·큰 제목만 **고운바탕 Bold**(명조 계열, 부분 글꼴 167KB) — 장부·두루마리 느낌.
- **원칙**: 대담함은 한 곳(횃불빛 = 누를 수 있는 주요 행동)에만. 나머지는 조용한 돌. 배치·문구·기능은 그대로(restyle 깊이, keep the layout).
- **기본값 점검**: 처음 안은 "검정 + 금색"을 남색으로만 바꾼 것이라 여전히 흔한 '어두운 바탕 + 강조색 하나'에 가까웠다 → 차가운 돌 바탕과 **따뜻한 양피지 글자**의 대비, 명조 제목, 주요 행동에만 횃불빛을 주는 쪽으로 고쳐 차별점을 만들었다.

## 3. 바꿀 항목 (사용자가 하나씩 고르는 단위)

| 번호 | 항목 | 성격 |
|---|---|---|
| R1 | 바탕·카드 색: 무채색 검정 → 아이콘의 밤 남색 돌 | 색 |
| R2 | 글자색·강조색: 회백 → 양피지, 금색 → 횃불 호박색 | 색 |
| R3 | 제목 글꼴: 화면 제목·큰 제목에 고운바탕 Bold (+167KB) | 글꼴 |
| R4 | 버튼·카드: 주요 버튼 횃불빛, 눌림 반응, 비활성 3단계 구분, 모서리 위계 | 컨트롤 |
| R5 | 하단 메뉴: 선택된 칸 위에 횃불색 막대 | 내비게이션 |
| R6 | 움직임·접근성: 팝업·알림 등장 모션, 포커스 링, 움직임 줄이기, 스크린리더 이름 | 모션·접근성 |
| (C1) | 색 값을 변수로 정리 — 화면 변화 없음, 위 항목의 바탕 | 내부 정리 |

## 4. 적용 후 다시 점검 (restyle/v3.2 브랜치)

| 도구 | 수정 전 | 수정 후 |
|---|---|---|
| hallmark sloplint | 19 FAIL · 23 REFLEX · 3 WARN | 1 FAIL(도장 없음, 면제) · 22 REFLEX(4px 간격 — 배치 유지라 그대로) · 0 WARN |
| web-design-guidelines | 위 1-1 목록 | 포커스 링·움직임 줄이기·HP 막대 transform·color-scheme·눌림/hover·비활성 3채널·touch-action·overscroll·tabular-nums·theme-color·aria-label·aria-live 해결. **남음**: div role=button 키보드 처리(배치 영향 없음, 사용자 선택), user-scalable=no(의도) |
| 화면 틀 점검(layout.mjs) | — | 34화면 × 360/390/480 폭, 문제 0건 |

## 5. 비교 자료

- R1 수정안(검정과 남색의 중간값)은 사용자 선택으로 적용됨 (원안 남색은 비교 페이지에만 남김).
- `compare/index.html` — 항목별(R1~R6) "앞 단계 → 그 항목 적용" 사진과 전체 34화면 수정 전·후. 같은 저장 데이터·같은 난수로 찍어 내용은 같고 스타일만 다르다.
- 사진은 390×844, webp. 수정 전은 main(a9513a6), 단계별은 각 커밋을 따로 빌드해서 찍었다.
- 찍는 도중 `scripts/*.mjs`가 끝날 때 vite 미리보기 서버(npx 자식)를 못 끄는 버그를 찾아 고쳤다 — 남은 서버가 다음 실행에서 옛 화면을 보여 주던 문제.

## 6. 다음 단계

사용자가 항목마다 그대로 / 빼기 / 고쳐서를 고르면: 뺄 커밋은 되돌리고, 고칠 항목은 고친 뒤 → code-review → `npm run check` → 문서·기획서 → main 푸시(빌드).
