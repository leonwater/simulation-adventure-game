# 외부 도구 사용 가이드 (Windows · 전역 설치)

> 이 문서는 아래 도구를 쓸 때 **먼저 참고하는 기준 문서**입니다. (CLAUDE.md에서 이 파일을 가리킵니다.)

- **대상 도구 14종**: frontend-design, ui-ux-pro-max, hallmark, emil-design-eng, web-design-guidelines, context7, code-review, superpowers, ponytail, security-audit, graphify, hyperframes, rea, claude-pxl (+ 마켓플레이스 `claude-plugins-official`)
- **기준**: 각 저장소 README·문서에 적힌 내용 (2026-11 시점). **[제안]** 표시는 문서에 없는 작성자의 판단입니다.
- **터미널**: PowerShell. 설치 후에는 Claude Code를 **새로 시작**해야 플러그인이 적용됩니다.
- 이전 버전에 있던 opencode, ComfyUI, ruflo는 목록에서 뺐습니다 (git 기록에서 복원 가능).

---

## 목차

1. [설치](#1-설치)
2. [도구별 사용법](#2-도구별-사용법)
3. [같이 쓰는 조합과 순서](#3-같이-쓰는-조합과-순서) — 새 UI(A) · **기존 UI 수정(A-2)** · 기능 개발(B) · 파악(C) · 역분석(D) · 영상(E)
4. [한눈에 보는 요약](#4-한눈에-보는-요약)
5. [이 프로젝트(모험가 키우기)에서 쓸 때](#5-이-프로젝트모험가-키우기에서-쓸-때)
6. [알려진 한계](#6-알려진-한계)

---

## 1. 설치

### 사전 준비

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.12
winget install astral-sh.uv
```

Claude Code는 공식 문서대로 설치하고, 설치 후 PowerShell을 다시 엽니다.
(`astral-sh.uv`만 graphify README로 확인했고, 나머지 winget ID는 작성자가 아는 값입니다.)

### 방법 A — 스크립트 한 번에

```powershell
git clone -b claude/beautiful-fermat-09dyl6 https://github.com/leonwater/claude.git
cd claude
powershell -ExecutionPolicy Bypass -File scripts\install_all.ps1
```

한 단계가 실패해도 계속 진행하고, 마지막에 실패 목록을 보여 줍니다.

### 방법 B — 한 줄씩 복사

| 구분 | 도구 | 명령 |
|---|---|---|
| 마켓플레이스 | claude-plugins-official | `claude plugin marketplace add anthropics/claude-plugins-official` |
| 플러그인 | frontend-design | `claude plugin install frontend-design@claude-plugins-official` |
| 플러그인 | context7 | `claude plugin install context7@claude-plugins-official` |
| 플러그인 | code-review | `claude plugin install code-review@claude-plugins-official` |
| 플러그인 | superpowers | `claude plugin install superpowers@claude-plugins-official` |
| 마켓플레이스 | hyperframes | `claude plugin marketplace add heygen-com/hyperframes` |
| 플러그인 | hyperframes | `claude plugin install hyperframes@hyperframes` |
| 마켓플레이스 | ui-ux-pro-max | `claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` |
| 플러그인 | ui-ux-pro-max | `claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| 마켓플레이스 | hallmark | `claude plugin marketplace add nutlope/hallmark` |
| 플러그인 | hallmark | `claude plugin install hallmark@hallmark` |
| 마켓플레이스 | ponytail | `claude plugin marketplace add DietrichGebert/ponytail` |
| 플러그인 | ponytail | `claude plugin install ponytail@ponytail` |
| 마켓플레이스 | rea | `claude plugin marketplace add morluto/rea` |
| 플러그인 | rea | `claude plugin install rea@rea` |
| 스킬 | security-audit | `npx -y skills add https://github.com/cloudflare/security-audit-skill -s security-audit -g -a claude-code -y --copy` |
| 스킬 | emil-design-eng | `npx -y skills add emilkowalski/skills -s emil-design-eng -g -a claude-code -y --copy` |
| 스킬 | web-design-guidelines | `npx -y skills add vercel-labs/agent-skills -s web-design-guidelines -g -a claude-code -y --copy` |
| CLI | graphify | `uv tool install graphifyy` → `graphify install` |
| 스킬 | claude-pxl | `git clone https://github.com/crsolver/claude-pxl $HOME\.claude\skills\claude-pxl` (Node 22.18+, 설치할 패키지 없음) |

- `claude plugin install`의 기본 범위는 **user(전체 프로젝트)** 입니다.
- 스킬은 `-g`라서 `%USERPROFILE%\.claude\skills\`에 설치됩니다. `--copy`는 Windows 심볼릭 링크 권한 문제를 피하려고 넣었습니다.
- 확인: `claude plugin list` / 제거: `claude plugin uninstall <이름>`

---

## 2. 도구별 사용법

**범례**: 🟢 자동 = 설치만 하면 관련 요청에서 알아서 켜짐 · 🔵 호출 = 직접 입력

### 2-1. 디자인 5종

#### frontend-design — 🟢 자동
- **하는 일**: 만들기 전에 주제에 맞는 디자인 방향(팔레트·타이포·레이아웃)을 잡아 뻔한 템플릿을 피합니다.
- **사용법**: 예) `Create a dashboard for a music streaming app`
- **주의**: "방향 설정" 단계입니다.

#### ui-ux-pro-max — 🟢 자동
- **하는 일**: 제품 유형에 맞춰 패턴·스타일·색·폰트·피해야 할 것·체크리스트를 **한 벌의 디자인 시스템**으로 생성합니다.
- **사용법**: 예) `Build a landing page for my SaaS product`, `디자인 시스템 먼저 생성해줘`
- **주의**
  - 플러그인으로 설치하면 스크립트가 플러그인 폴더 안에 있습니다.
  - `python ~\.claude\skills\ui-ux-pro-max\scripts\search.py ...` 직접 실행은 `npm i -g ui-ux-pro-max-cli` → `uipro init --ai claude --global`로 설치했을 때의 경로입니다.
  - Windows는 `python3` 대신 `python`을 씁니다.

#### hallmark — 🔵 호출
- **하는 일**: AI 티 나는 구성(제목 위 소제목, 대문자 라벨, 의미 없는 빈 카드 등)을 피해 페이지를 만들고, 브라우저에서 린트한 뒤 새 맥락의 리뷰어가 검토합니다.
- **사용법**
  - `/hallmark:hallmark <요청>` (플러그인 설치 시 이름 앞에 `hallmark:`)
  - `redesign ./src/app` — 내용·연결을 유지하고 재설계
  - `audit ./index.html` — 수정 없이 보고만
  - `custom`이라고 하면 테마 없이 설계
- **주의**: 브라우저 검사는 `npm i -g puppeteer-core` + Chrome이 필요합니다(없으면 정적 검사만). 결과물은 자체 완결형 HTML/CSS입니다.

#### emil-design-eng — 🔵 호출
- **하는 일**: 애니메이션 곡선·시간·디테일 판단 기준으로 UI를 다듬습니다. 리뷰는 Before/After 표로 출력합니다.
- **사용법**: `/emil-design-eng` 후 질문, 또는 `이 컴포넌트 애니메이션 리뷰해줘`
- **주의**: 질문 없이 처음 부르면 준비 메시지만 냅니다.

#### web-design-guidelines — 🔵 호출
- **하는 일**: Vercel Web Interface Guidelines(100+ 규칙)로 UI 코드의 접근성·포커스·폼·애니메이션·성능 등을 점검합니다. 코드는 생성하지 않고 `file:line`으로 보고합니다.
- **사용법**: `/web-design-guidelines src/components/**`, 또는 `review my UI`, `check accessibility`
- **주의**: 실행할 때마다 최신 규칙을 인터넷에서 받아오므로 **네트워크가 필요**합니다.

### 2-2. 개발 워크플로 4종

#### superpowers — 🟢 자동
- **하는 일**: 만들기 전에 의도를 묻고(brainstorming) → 설계 승인 → 2~5분 단위 구현 계획 → 작업별 서브에이전트 구현·리뷰 → 브랜치 마무리를 강제합니다.
- **사용법**: 코딩 요청만 하면 시작됩니다. 이상하면 `figure out what went wrong with superpowers in this session`
- **주의**: TDD(RED→GREEN→REFACTOR)를 강제하며, 테스트보다 먼저 쓴 코드는 삭제한다고 README에 적혀 있습니다. 작은 수정에는 번거로울 수 있습니다.

#### ponytail — 🟢 자동 (매 세션)
- **하는 일**: 새 코드 대신 기존 코드·표준 라이브러리를 먼저 쓰게 해 코드량을 줄입니다. 검증·보안·접근성은 줄이지 않습니다.
- **사용법**

| 명령 | 뜻 |
|---|---|
| `/ponytail lite` · `full` · `ultra` · `off` | 강도 조절 |
| `/ponytail-review` | diff 리뷰 |
| `/ponytail-audit` | 저장소 전체 점검 |
| `/ponytail-debt` | 미뤄 둔 shortcut(주석 장부) |
| `/ponytail-gain` | 줄인 양 |
| `/ponytail-help` | 도움말 |

- **주의**: 훅이 Node.js를 쓰므로 PATH에 `node`가 있어야 합니다. 기본 강도는 `full` (`PONYTAIL_DEFAULT_MODE` 또는 `%APPDATA%\ponytail\config.json`).

#### context7 — 🟢 자동 (MCP)
- **하는 일**: 라이브러리의 현재 문서·예제를 가져와 낡은/없는 API 사용을 막습니다. 도구: `resolve-library-id`, `query-docs`.
- **사용법**: 요청에 라이브러리 이름을 넣습니다. 예) `Next.js 최신 문서 기준으로 …`
- **주의**: 질문이 Context7 서버로 전송됩니다. API 키(`CONTEXT7_API_KEY`)는 선택이며, 없으면 익명 공용 한도를 씁니다.

#### code-review — 🔵 호출
- **하는 일**: PR을 에이전트 4개(CLAUDE.md 준수 2, 버그 1, git 이력 1)로 병렬 검토합니다. 신뢰도 80 미만은 버리고 80 이상만 PR 댓글로 남깁니다.
- **사용법**: PR 브랜치에서 `/code-review`
- **주의**: 닫힘·초안·사소한·이미 리뷰한 PR은 건너뜁니다. CLAUDE.md가 구체적일수록 정확합니다.

### 2-3. 분석·감사 3종

#### security-audit — 🟢 자동 / 🔵 호출
- **하는 일**: 정찰 → 탐색 → 후보 검증 → 구조화 출력 → 독립 재검증 → 보고서의 6단계 보안 감사.
- **사용법**: `security audit this codebase`, `find security vulnerabilities in ./src`
- **결과 파일**: `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`, `findings.json`
- **주의**
  - 출력 위치를 지정하지 않으면 `~/security-audit-skill/<repo>/run-<N>`에 저장됩니다.
  - 여러 번 돌릴수록 커버리지가 늘어납니다(1회는 약 절반).
  - 대상 코드 실행은 샌드박스가 있을 때만 합니다.

#### graphify — 🔵 호출
- **하는 일**: 코드·문서·PDF·이미지를 지식 그래프로 만들어 grep 대신 질의합니다. 코드는 tree-sitter로 로컬 파싱합니다.
- **사용법**

| 명령 | 뜻 |
|---|---|
| `/graphify .` | 그래프 생성 |
| `/graphify query "auth 와 DB 의 연결은?"` | 질의 |
| `/graphify path "A" "B"` | 두 개념 사이 경로 |
| `/graphify explain "X"` | 설명 |
| `/graphify . --update` | 변경분만 갱신 |

- **결과**: `graphify-out\graph.html`, `GRAPH_REPORT.md`, `graph.json`
- **주의**: 문서·PDF·이미지는 모델로 의미를 추출합니다(코드만이면 로컬). `graphify hook install`은 커밋 시 자동 재빌드합니다.

#### rea — 🟢 자동 (MCP)
- **하는 일**: 바이너리·Electron/JS 앱·.NET·APK·웹사이트를 로컬에서 역분석하고, 결론마다 근거와 한계를 제시합니다.
- **사용법**
  - 예) `Understand how search works in the Notes app, show me the evidence, and build a similar feature for my project.`
  - CLI: `npx -y rea-agents@latest analyze-javascript-application C:\경로\app --json`
- **주의**
  - 공식 출처는 `morluto/rea`, `rea.tools`, npm `rea-agents`뿐입니다.
  - 네이티브 바이너리는 Ghidra/IDA를 따로 설치해야 합니다(Windows Ghidra는 experimental, `rea setup`은 설치해 주지 않음).
  - 플러그인과 `rea setup` 중 하나만 씁니다.
  - **합법적 분석만** 합니다(DRM·라이선스 우회 등 비지원, `DISCLAIMER.md`).

### 2-4. 영상 1종

#### hyperframes — 🔵 호출
- **하는 일**: HTML·CSS·미디어를 결정적 MP4로 렌더링합니다. 에이전트가 영상 계획 → HTML 작성 → 미리보기 → 렌더를 진행합니다.
- **사용법**
  - `/hyperframes:hyperframes` 후 `10초짜리 제품 소개 영상 만들어줘`
  - CLI: `npx hyperframes init my-video` → `preview` → `render`
- **주의**: CLI는 Node.js 22+와 FFmpeg가 필요합니다. PowerShell에서는 JSON 옵션을 파일로 넘기세요. Windows는 Studio 앱(`Install-HyperFrames.exe`, hyperframes.dev/studio, 64비트 Intel/AMD)이 가장 쉽습니다.

### 2-5. 그림 1종

#### claude-pxl — 🟢 자동 (스킬 `pxl-pixel-art`)
- **하는 일**: 픽셀 아트를 코드(`.px.js`)로 적으면 PNG·확대 미리보기·스프라이트 시트·GIF로 뽑습니다. 좌우 대칭(`mx`), 자동 외곽선(`outline`), 명암 단계(`ramps` + `shade`/`light`), 빛 번짐(`glow`), 색만 바꾼 변형(`base` + `swap`), 부품 재사용(`_이름` + `stamp`), 프레임 애니메이션(`anim`)을 지원합니다.
- **사용법**
  - 요청: `슬라임 픽셀 그림 그려줘` → 스킬이 켜져 `.px.js`를 쓰고 빌드합니다.
  - 직접: `node <스킬 폴더>/bin/pxl.js build art.px.js` → `out/sprites/*.png`, `out/_preview/*.png`(확대·격자)
  - 칸 단위 수정: `pxl ascii art.px.js <이름>` (좌표 눈금 붙은 글자 미리보기) · 실시간 보기: `pxl serve art.px.js`
- **주의**
  - 격자 줄은 **모두 같은 길이**로 씁니다. 짧은 줄은 오른쪽이 채워져 `mx` 대칭이 어긋납니다.
  - 그림 안의 덧그림도 `mx`로 함께 뒤집힙니다. 검·방패처럼 **비대칭인 것**은 대칭 몸을 `_부품`으로 만들고, 완성 그림에서 `stamp` 후 덧그립니다.
  - `light`/`shade`에 `density` 0.5를 주면 바둑판 무늬(디더)가 생깁니다. 작은 그림에서는 지저분해 보일 수 있습니다.

---

## 3. 같이 쓰는 조합과 순서

### A. 새 화면(웹/앱 UI) 만들기 — 디자인 5종 + context7

| 순서 | 도구 | 하는 일 |
|---|---|---|
| 1 | frontend-design | 주제에 맞는 디자인 방향을 정한다 |
| 2 | ui-ux-pro-max | 방향을 색·폰트·패턴·체크리스트가 있는 디자인 시스템으로 구체화한다 |
| 3 | hallmark | 구성을 만들거나(`/hallmark:hallmark …`) 이미 만든 화면을 audit해 AI 티 나는 부분을 걸러낸다 |
| 4 | emil-design-eng | 애니메이션 곡선·속도·디테일을 다듬는다 |
| 5 | web-design-guidelines | 접근성·포커스·폼·성능 빠진 곳을 최종 점검한다 |

구현 중 프레임워크 API는 context7가 최신 문서로 보조합니다.

- 1·2·3단계는 모두 "처음 방향을 정하는" 도구라 겹칩니다. 한 요청에 다 켜지면 지시가 충돌할 수 있습니다.
  **[제안]** 1→2로 방향과 시스템을 먼저 확정하고, 3은 만든 결과를 **audit**하는 용도로 씁니다.
- **[제안]** hallmark는 시작할 때 프로젝트의 고정된 `design.md`(폰트·팔레트)를 읽는다고 README에 적혀 있습니다. ui-ux-pro-max가 만든 시스템을 `design.md`로 저장해 두면 3단계가 그 기준을 따를 가능성이 있습니다(직접 확인하지 못했습니다).
- 4·5는 만든 뒤 점검하는 단계라 마지막에 한 번씩만 돌립니다.

### A-2. 기존 UI 수정하기 — 진단 먼저, 수정은 그다음

새로 만드는 것이 아니므로, **수정 없이 현황을 진단하는 단계를 먼저** 둡니다.

#### 공통 첫 단계 (수정 없음)

| 도구 | 하는 일 | 입력 예 |
|---|---|---|
| web-design-guidelines | 접근성·포커스·폼·성능 등 빠진 곳을 `file:line`으로 보고 | `/web-design-guidelines src/**` |
| hallmark audit | 코드를 수정하지 않고 AI 티 나는 구성만 점검 | `/hallmark:hallmark audit ./src/app` |

- **[제안]** 결과를 파일로 저장해 두면 수정 후 비교 기준이 됩니다.
- 앱이 크면 먼저 `/graphify .`로 구조를 파악하고, query/path로 해당 컴포넌트와 연결 관계를 찾습니다.

#### 경우 1 — 일부만 다듬기 (색·간격·티 나는 부분)

1. web-design-guidelines + hallmark audit으로 진단
2. hallmark **polish** 모드 (README: polish는 티 나는 부분만 고친다)
3. 필요한 곳에 emil-design-eng (예: `이 컴포넌트 애니메이션 리뷰해줘`)
4. web-design-guidelines로 재점검

#### 경우 2 — 전체 리스타일 (분위기는 바꾸고 기능은 유지)

| 순서 | 도구 | 하는 일 |
|---|---|---|
| 1 | 진단 | 위의 공통 첫 단계 |
| 2 | frontend-design | 목표 방향 정하기 (설명: 새로 만들 때뿐 아니라 기존 UI를 바꿀 때도 사용) |
| 3 | ui-ux-pro-max | 목표 스타일에 맞는 색·폰트 시스템을 뽑아 **기존 토큰에 옮기기** |
| 4 | hallmark redesign | 내용·연결은 유지하고 시스템과 레이아웃을 바꾸기 |
| 5 | emil-design-eng | 모션 다듬기 |
| 6 | web-design-guidelines | 재점검 |
| 7 | code-review | PR을 올린 뒤 `/code-review` |

**3단계 (ui-ux-pro-max)** — README에 기존 앱 테마 변경용 프롬프트와 체크리스트(감사 → 매핑 → 이전 → 검증)가 있습니다. 핵심은 다음과 같습니다.

- 프레임워크·라우트·컴포넌트·기존 테마 토큰을 먼저 조사한다.
- 컴포넌트 구조와 동작은 유지한다.
- 새 테마 체계를 만들지 말고 **기존 의미 토큰**(background, primary, border 등)을 갱신한다.
- 하드코딩된 스타일은 컴포넌트 하나씩 교체한다.
- 매 묶음마다 대비·키보드 포커스·반응형·라이트/다크를 확인한다.
- README는 검색 결과가 앱을 자동으로 고쳐 주지는 않는다고 밝힙니다.

**4단계 (hallmark)** — README는 "이미 있는 디자인은 이름을 지정해야 건드린다"고 적고 있습니다.

- 호출: `/hallmark:hallmark redesign ./src/app`
- `keep the layout`을 붙이면 스타일만 바꾸고, 안 붙이면 레이아웃까지 바꿉니다.
- 작업 전에 모든 링크·필드·핸들러·제목을 기록하고, 하나라도 빠지면 실패로 처리하며, 마지막에 전후 비교를 보여 줍니다.

#### 경우 3 — 기능 변경이 함께 있을 때

위 순서 **앞에 superpowers**를 둡니다. 설계 → 계획 → TDD → 작업별 리뷰가 자동으로 진행되고, 디자인 도구는 그 구현 단계 안에서 씁니다. 라이브러리 API는 context7이 최신 문서로 보조합니다.

#### 주의

- frontend-design·ui-ux-pro-max·hallmark는 모두 **방향을 잡는 도구**라 겹칩니다. **[제안]** 방향 확정은 2·3단계에서 하고, hallmark는 진단(audit)과 마무리(polish/redesign)에 씁니다.
- 위 순서의 연결(진단 결과 저장, 2→3→4 순서)은 작성자의 판단입니다. 각 도구의 동작은 README 기준이지만 이 조합을 실제로 돌려 보지는 못했습니다.
- hallmark의 브라우저 린트는 `puppeteer-core` + Chrome이 있어야 합니다. 없으면 정적 검사만 실행됩니다.
- **[제안]** 단계마다 커밋해 두면 되돌리기 쉽습니다.

---

### B. 기능 개발 — superpowers 중심

| 순서 | 도구 | 하는 일 |
|---|---|---|
| 0 | graphify (큰 코드베이스일 때) | `/graphify .`로 구조를 먼저 파악하고 query/path로 관련 부분을 찾는다 |
| 1 | superpowers | 요청하면 brainstorming(질문) → 설계 승인 → 계획 → 구현 + 작업별 리뷰 → 브랜치 마무리가 자동으로 진행된다 |
| 2 | context7 | 구현 중 라이브러리 최신 문서 조회 |
| 3 | ponytail | 구현 시 기존 코드 재사용·최소 코드. 끝나면 `/ponytail-review`로 diff 점검 |
| 4 | code-review | PR을 올린 뒤 `/code-review`로 확신 높은 문제만 댓글로 받는다 |
| 5 | security-audit | 큰 기능이 끝났거나 릴리스 전에 전체 감사. 보고서의 needs_validation은 사람이 확인 |

- superpowers는 "설계·TDD를 항상 거친다", ponytail은 "코드를 최소로 쓴다"로 방향이 달라 부딪힐 수 있습니다. 함께 쓸 때 실제로 충돌하는지는 확인하지 못했습니다. **[제안]** 처음엔 둘 다 켜고, 불편하면 `/ponytail lite`나 `/ponytail off`로 조절합니다.
- security-audit(전체 감사)와 ponytail-audit·code-review(변경분 리뷰)는 범위가 다릅니다. **평소엔 code-review, 마일스톤마다 security-audit.**

### C. 기존 프로젝트 파악 → 개선

1. graphify `/graphify .` → `GRAPH_REPORT.md`로 핵심 개념·구조 확인
2. security-audit로 위험 지점 확인 (필요 시)
3. superpowers로 개선안을 설계·계획 → 구현
4. ponytail-audit으로 줄일 코드 확인

### D. 앱 동작을 분석해 비슷한 기능 만들기 — rea + superpowers

1. rea로 대상 앱의 동작과 근거를 분석 (**합법적 범위, 직접 소유·허가된 대상만**)
2. 분석 결과를 입력으로 superpowers 흐름(설계 → 계획 → 구현)을 시작
3. 화면이 포함되면 A 순서로 마무리

rea README의 예시 프롬프트가 "이해 → 근거 제시 → 내 프로젝트에 비슷한 기능 구현" 흐름입니다. 2·3의 연결은 **[제안]**입니다.

### E. 영상 제작 — hyperframes

대본·구성은 hyperframes의 `/hyperframes` 흐름(계획 → HTML → 미리보기 → 렌더)을 따릅니다.
**[제안]** 브랜드 색·폰트가 필요하면 ui-ux-pro-max로 먼저 시스템을 뽑아 프롬프트에 넣습니다(문서에 연동 근거는 없습니다).

---

## 4. 한눈에 보는 요약

| 하고 싶은 일 | 사용 순서 |
|---|---|
| 새 UI 디자인 | frontend-design → ui-ux-pro-max → hallmark → emil-design-eng → web-design-guidelines |
| 기존 UI 일부 다듬기 | web-design-guidelines + hallmark audit(진단) → hallmark polish → (emil-design-eng) → web-design-guidelines(재점검) |
| 기존 UI 전체 리스타일 | 진단 → frontend-design → ui-ux-pro-max(기존 토큰에 이전) → hallmark redesign → emil-design-eng → web-design-guidelines → code-review |
| 기능 개발 | (graphify) → superpowers (+ context7, ponytail) → code-review → security-audit |
| 코드베이스 파악 | graphify → security-audit / ponytail-audit |
| 앱 역분석 후 구현 | rea → superpowers |
| 영상 | hyperframes (+ ui-ux-pro-max로 브랜드 시스템) |
| 게임 픽셀 그림 | claude-pxl → 게임 화면 스크린샷으로 확인 |

---

## 5. 이 프로젝트(모험가 키우기)에서 쓸 때

> **[제안]** 아래는 이 저장소의 작업 규칙(CLAUDE.md)에 맞춰 덧붙인 내용입니다. 위 도구 문서에는 없는 판단입니다.

- **작업 순서는 CLAUDE.md가 우선**입니다. 도구는 그 순서 안에서 보조로 씁니다. 도구가 요구하는 흐름(예: superpowers의 질문·승인 단계)이 "정해지지 않은 것이 있으면 빌드 보류" 규칙과 부딪히면 CLAUDE.md를 따릅니다.
- **기존 화면을 고칠 때는 3장 A-2 순서**(진단 먼저, 수정은 그다음)를 따릅니다. 이 앱은 색을 `web/src/ui/app.css`의 `:root` 토큰(`--gold`, `--card` 등)으로 쓰므로, 리스타일은 하드코딩이 아니라 이 토큰을 갱신하는 방식으로 합니다 (ui-ux-pro-max 3단계의 "기존 의미 토큰 갱신"과 같은 방향).
- **UI(`web/src/ui`, `web/src/screens`)를 바꾼 뒤** 점검: `web-design-guidelines`(접근성·포커스), 애니메이션이 들어가면 `emil-design-eng`. 화면 틀 점검은 기존 도구 `web/scripts/layout.mjs`가 이미 있으므로 먼저 돌립니다.
- **새 화면 방향**을 정할 때만 `frontend-design` → `ui-ux-pro-max` 순서로 씁니다. 기존 화면의 작은 수정에는 켜지 않습니다 (앱은 어두운 톤·금색 포인트·Pretendard 글꼴로 이미 정해져 있음).
- **큰 개편 뒤 코드 정리**: `ponytail-review`·`ponytail-audit`. 쓰지 않는 함수·CSS 점검(CLAUDE.md 4번)과 함께 봅니다.
- **릴리스 전 보안 감사**는 `security-audit`. 이 프로젝트는 서명 키·비밀번호를 저장소에 넣지 않는 규칙이 있으니, 보고서에 키 관련 항목이 나오면 우선 확인합니다.
- **코드 구조 질문**(예: 전투 계산이 어디서 시작하는지)에는 `graphify`를 쓸 수 있습니다. 결과 폴더 `graphify-out/`는 저장소에 넣지 않습니다.
- **전투 유닛 픽셀 그림**은 `claude-pxl`. 모두 오른쪽을 보게 그리고 몬스터는 `flip: "x"`로 뒤집는다(플레이어와 마주 봄). 원본은 `web/art/units.px.js`, 그리기는 `bash web/scripts/sprites.sh`(claude-pxl을 고정 커밋으로 `web/.pxl/`에 받아 빌드 → `web/public/sprites/`). 새 그림은 `web/src/screens/battle.ts`의 `SPRITES` 목록에 이름(직업은 영문 소문자, 몬스터는 `monsters.json` Id)을 추가해야 게임에 나옵니다. 그림 높이는 24칸 이하(게임에서 3배). 클라우드 세션에서 실행이 막히면 저장소 `.claude/settings.json`의 허용 규칙을 확인합니다.
- 이 프로젝트에서 쓸 일이 거의 없는 도구: `hyperframes`(영상), `rea`(역분석), `context7`(필요할 때만 Vite·Capacitor·Playwright 등 라이브러리 문서 확인).

---

## 6. 알려진 한계

- 설치 스크립트와 `claude plugin` 명령은 Windows에서 직접 실행해 보지 못했습니다(작업 환경은 리눅스이고 설치 실행이 막혀 있었음).
- rea가 "별이 가장 많은 리버스 엔지니어링 도구"인지는 확인하지 못했습니다(GitHub API 접근 불가).
- superpowers↔ponytail, hallmark↔design.md 연동은 문서에 근거가 없어 **[제안]**으로만 적었습니다.
- 클라우드 작업 환경에서는 context7 MCP가 프록시 오류(`ERR_PROXY_TUNNEL`)로 연결되지 않았습니다. 사용자 PC와는 별개 문제일 수 있으나, PC에서의 동작은 확인하지 못했습니다.
- hyperframes 플러그인은 켜지지만, 함께 받아야 할 추가 패키지는 `bun.lock` 구성 때문에 설치되지 않는다는 안내가 나왔습니다(클라우드 리눅스 환경 기준).
