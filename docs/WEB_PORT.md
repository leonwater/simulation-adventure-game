# 웹 이식 개발 (v2.5~)

Unity 빌드(15~25분)와 화면 확인 불가 때문에 토큰·시간이 많이 들어서, **웹(TypeScript)으로 개발하고 Capacitor로 앱(안드로이드, 나중에 iOS)을 만든다.**
Unity 프로젝트는 `unity-v2.4` 태그로 고정해 두고 이식이 끝날 때까지 **기준(레퍼런스)** 으로만 쓴다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `web/` | 새 게임 (Vite + TypeScript, 의존성 없는 DOM 도우미 `src/ui/kit.ts`) |
| `web/src/core/` | 게임 규칙 (C# `Assets/Scripts/Core`를 옮긴 것). 화면과 무관한 순수 함수·클래스 |
| `web/src/screens/` | 화면 (C# `Game/Screens`를 옮긴 것) |
| `web/src/data/*.json` | 데이터 표(스킬·몬스터·소모품·이벤트·직업·밸런스 상수). v2.6부터 **웹 JSON이 원본** (C#은 고정) |
| `web/tests/` | vitest. C#과 같은 값이 나오는지(패리티) 확인 |
| `web/android/` | Capacitor 안드로이드 프로젝트 (웹 빌드를 감싼다) |
| `Assets/` `tools/verify` `tools/balance` | Unity판 (고정, 기준용) |

## 매일 쓰는 명령 (`web/` 안에서)

```
npm run dev        # 개발 서버 (핫 리로드)
npm run check      # 타입 검사 + 테스트 + 빌드  ← 푸시 전 필수
npm run preview    # 빌드 결과를 localhost:4173 으로
npm run shot [url] [out.png]   # 390×844 스크린샷 (화면 확인은 이것으로, shots/ 폴더)
npm run balance -- 150 3 Normal,Hard   # 봇 밸런스 시뮬레이션 (C# tools/balance/run.sh와 같은 출력)
```

- 화면을 바꾼 뒤에는 `npm run build && npm run preview &` → `npm run shot` → 이미지를 열어 확인한다 (Unity에서는 불가능했던 일).
- 푸시하면 `.github/workflows/web-app.yml`이 테스트 → 웹 zip → APK를 만들어 Releases `web-latest`, `android-latest`에 올린다 (약 5~8분).

## 이식 순서

| 단계 | 내용 | 확인 방법 |
|---|---|---|
| P0 | 뼈대: 빌드·테스트·스크린샷·Capacitor·CI·데이터 내보내기 **(완료)** | `npm run check`, 첫 화면 스크린샷 |
| P1a | Core 기본: 캐릭터·능력치·레벨·등급·직업, 아이템·장비·강화, 스킬 | C# 테스트(`CharacterTests` `ItemSkillTests` 등)를 vitest로 옮김 — **완료** (`web/src/core` enums·names·jobs·skills·items·character·equipment, `tests/core-basics.test.ts`) |
| P1b | Core 전투(상태 이상·보스 특성·몬스터 행동·확률) | `BattleTests` `V21~V24Tests`를 옮김 + 통계 비교 — **완료** (`battle` `bosskit` `enemies` `monsters` `status` `combatant`, `tests/battle.test.ts`). 보상 정산(`CollectRewards`)은 드롭표가 있는 P1c에서 이식 |
| P1c | Core 던전: 층 생성(배치 규칙)·이동 패드·이벤트 34종·드롭·정산 | `DungeonTests` `SpecialEventTests` `V23~V24Tests` — **완료** (`map` `generator` `dungeon` `events` `eventrules` `explore` `mapevents` `loot` `settlement` `guild`, `tests/dungeon.test.ts`) |
| P1d | Core 마을·저장: 상점·길드·퀘스트·창고, 저장(C#과 **같은 JSON 필드 이름**이라 Unity 저장도 읽을 수 있게) | `TownTests` `SaveTests` — **완료** (`shop` `save` `session`, `tests/town-session.test.ts`; Unity 저장 샘플 `tests/fixtures/unity-save.json` 읽기 · TS 저장을 C#이 읽는 것도 확인) |
| P1e | 자동 플레이 봇 + 밸런스 시뮬레이션 | C# `tools/balance` 결과와 사망률 ±3%p 이내 — **완료** (`web/src/sim` `npm run balance`, 보통 사망률 C#과 ±3%p 이내: C# 30.3/32.1/38.7/40.2/52.0/61.4 → 웹 27.8/30.8/37.4/41.8/53.0/61.5) |
| P2 | 화면: 시작·등록 → 마을·시설 → 캐릭터·가방·스킬 → 던전 → 전투 → 이벤트·상인 → 정산·클리어 → 설정 → 튜토리얼 | 화면마다 `npm run shot`, UI 시안(Claude Design)과 비교 |
| P3 | 패리티 확인: 테스트 187개 전부 대응, 밸런스·사망률 일치 | 완료 (아래 대응표) |
| P4 | 교체: 릴리스 태그를 `android-latest` `web-latest`로 (완료). Unity 워크플로는 지우지 않고 수동 실행 전용·`unity-android` `unity-web` 태그로 보관 | 새 APK 실기기 확인 |

- 새 기능·수정은 **이식된 부분은 TS에만** 한다. 아직 이식 안 된 부분을 고쳐야 하면 먼저 그 부분을 이식한다 (Unity는 고치지 않는다).
- 데이터 표는 v2.6부터 `web/src/data/*.json`을 직접 고친다 (`tools/export`는 C# 기준과 비교할 때만). 직업·스킬 요약 `docs/JOBS_SKILLS.md`도 함께 고친다.
- 난수는 C#과 순서가 다르다 (mulberry32). 같은 시드 결과 비교 대신 통계(확률·평균)로 비교한다.

## 주의

- Capacitor APK는 Unity APK와 서명 키가 달라 **덮어 설치되지 않는다** (지우고 설치). 저장 파일도 기기 안 위치가 달라 자동으로 이어지지 않는다 (P1d의 저장 가져오기로 해결).
- 글꼴은 `web/public/fonts` 프리텐다드(Regular·Bold, SIL OFL 1.1, 상업적 이용·앱 포함 배포 가능)를 쓴다.
- Node 22, Vite 8, TypeScript 7, Vitest 5, Capacitor 8 (APK 빌드는 JDK 21).


## P3 테스트 대응표 (C# 187개 → 웹)

| C# 파일 | 웹 테스트 파일 |
|---|---|
| BattleTests · BossTests(Bosses_StayBeatable 제외) | `battle.test.ts` |
| CharacterTests · ItemSkillTests(SkillDescriptions 제외) | `core-basics.test.ts` · `balance.test.ts` |
| DungeonTests · SpecialEventTests 7개 · V23 일부 | `dungeon.test.ts` |
| TownTests · SessionTests · V23 일부 | `town-session.test.ts` |
| SkillV12 · V21 · V22 · Bosses_StayBeatable · SkillDescriptions | `p3-a.test.ts` |
| V16 · V17 · V18 · V19 | `p3-b.test.ts` |
| V20 · V24 · TrialGate·EventBattles · V23 일부 | `p3-c.test.ts` |

- 대응하지 않은 것: `Json_ParsesNumbersAndEscapes` (C# 자체 JSON 파서 검증, TS는 `JSON.parse`)
- 코어 이식 버그는 발견되지 않음. 밸런스·사망률은 P1e 결과(±3%p)로 확인

## APK 업데이트 설치 (고정 서명 키)

- 안드로이드는 **같은 키로 서명한 APK끼리만** 덮어 설치(업데이트)된다. 키가 없으면 빌드마다 임시 키가 새로 만들어져 업데이트가 안 된다.
- 해결: 고정 키를 GitHub Secrets 4개로 넣는다 → `ANDROID_KEYSTORE_BASE64` · `ANDROID_KEYSTORE_PASS` · `ANDROID_KEYALIAS_NAME` · `ANDROID_KEYALIAS_PASS`. `web-app.yml`이 있으면 그 키로 서명하고, 없으면 경고만 남기고 임시 키로 만든다.
- 키 파일·비밀번호는 저장소에 올리지 않는다(`.gitignore`에 `*.jks`). 키를 잃어버리면 새 키로 바꿔야 하고 그때 한 번은 지우고 설치해야 한다.
- 키를 처음 적용하는 빌드는 기존(임시 키) 앱과 서명이 달라 **한 번만 지우고 설치**한다. 그 뒤로는 덮어 설치된다.
