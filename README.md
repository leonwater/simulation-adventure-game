# 모험가 키우기

한 명의 모험가를 오래 키워 던전 최하층(1차 30층)을 정복하는 **모바일 텍스트 시뮬레이션 RPG**입니다.
Unity로 만든 앱 게임(Android·iOS, 세로 화면)이며, 기획서와 UI 시안을 바탕으로 개발했습니다.

## 바로 열기

1. **Unity 6 (6000.0 LTS)** 를 설치합니다. 기기 빌드를 하려면 Android Build Support(또는 iOS Build Support) 모듈도 함께 설치합니다.
2. Unity Hub → **Add project from disk** → 이 저장소 폴더를 선택합니다.
3. 처음 열면 `Assets/Scenes/Main.unity`가 자동으로 생성되고 빌드 씬·앱 이름·세로 화면이 설정됩니다.
   (다시 적용하려면 메뉴 **모험가 키우기 → 프로젝트 설정 다시 적용**)
4. `Main` 씬을 열고 ▶ 재생. Game 뷰 해상도를 **390 × 844**(또는 아무 세로 비율)로 맞추면 시안과 같은 화면이 나옵니다.

> 화면은 프리팹 없이 코드(uGUI)로 만들어지므로 씬에는 카메라만 있습니다. 실행하면 `GameApp`이 자동으로 생성됩니다.

### 기기 빌드

- **Android**: File → Build Profiles(Build Settings) → Android → Switch Platform → Build.
- **iOS**: iOS로 전환 → Build → 생성된 Xcode 프로젝트에서 서명 후 실행.
- 패키지 이름 `com.leonwater.adventurer` (에디터 설정 스크립트 `Assets/Scripts/Editor/ProjectSetup.cs`에서 변경).

### APK 자동 빌드 (GitHub Actions)

`main`에 게임 파일(`Assets`·`Packages`·`ProjectSettings`)이 바뀌어 올라오면 APK가 자동으로 만들어집니다.
Actions 탭 → **Android APK 빌드** → **Run workflow**로 직접 실행할 수도 있습니다.

- 결과: 저장소 **Releases → 최신 APK (android-latest)** 의 `adventurer.apk` (휴대폰에서 바로 받기)
- 처음 한 번 저장소 **Settings → Secrets and variables → Actions**에 비밀값 3개를 등록해야 합니다.
  - `UNITY_LICENSE`: Unity Hub로 로그인한 PC의 `Unity_lic.ulf` 파일 내용 전체
    (Windows `C:\ProgramData\Unity\Unity_lic.ulf`, Mac `/Library/Application Support/Unity/Unity_lic.ulf`)
  - `UNITY_EMAIL`, `UNITY_PASSWORD`: Unity 계정
- 선택: `ANDROID_KEYSTORE_BASE64`·`ANDROID_KEYSTORE_PASS`·`ANDROID_KEYALIAS_NAME`·`ANDROID_KEYALIAS_PASS`를 넣으면 고정 키로 서명되어,
  새 버전을 기존 앱 위에 바로 덮어 설치할 수 있습니다. 없으면 업데이트 때 기존 앱을 지우고 설치해야 합니다 (저장 데이터도 지워짐).
- 빌드 스크립트: `Assets/Scripts/Editor/CIBuild.cs`, 워크플로: `.github/workflows/android-build.yml`

## 프로젝트 구조

| 경로 | 내용 |
| --- | --- |
| `Assets/Scripts/Core` | 순수 C# 게임 로직 (Unity 참조 없음). 캐릭터·아이템·마을·던전·전투·저장 |
| `Assets/Scripts/Core/GameBalance.cs` | **모든 밸런스 수치(임시값)를 모아 둔 파일** |
| `Assets/Scripts/Game` | Unity 실행부: 부트스트랩(`GameApp`), UI 도구(`UI/`), 화면(`Screens/`), 파일 저장 |
| `Assets/Scripts/Editor` | 프로젝트 자동 설정 |
| `Assets/Tests/EditMode` | NUnit 테스트 134개 (Unity Test Runner와 `dotnet test` 양쪽에서 실행) |
| `Assets/Resources/Fonts` | 나눔고딕·고운바탕 (SIL OFL 1.1) |
| `tools/verify` | Unity 없이 검증하는 스크립트 |
| `tools/balance` | 밸런스 시뮬레이션 (자동 플레이 봇 진행 속도·사망률, 층별 전투 소모, 보스 특성 켬/끔 비교) |
| `docs/DEV_PLAN.md` | 작업 기획 (파트 구성, 임시로 정한 규칙) |

## 화면 (UI 시안 + 수정 사항 27개 반영, 기획서 v1.2)

시작(시작하기·이어하기 요약·설정·종료) · 프롤로그 · 길드 등록(이름→직업→난이도→확인) · 마을(시설 2×2 아이콘 카드) ·
길드(퀘스트·등급·창고) · 상점(3열 카드) · 대장간 · 수련장 · 캐릭터 · 가방·장비 · 스킬 · 설정 ·
던전 탐험(테마 색 미니맵·전체 지도) · 전투(도형 무대·연출) · 특수 이벤트 · 정산(패배 비교표·귀환·엔딩)

- 튜토리얼(직접 해 보기): 화면 한 곳만 밝게 남기고 말풍선으로 안내(코치 마크). 상점·길드·대장간·수련장에 직접 들어가 부분별 설명 → 던전 입장 → 고정 1층(미니맵·길 선택·전투·레벨 업) → 귀환 후 정산·창고. 언제든 건너뛰기, 설정에서 다시 보기.
- 전투: 내 원형(왼쪽, 누르면 캐릭터 정보), 적 최대 4(일반 사각형·엘리트 굵은 테두리·보스 육각형, HP 숫자 표시). 적을 눌러 대상 선택, 선택지 아래 예상 피해, 길게 누르면 피해 계산식·부가 효과·성공 확률 내역.
- 보스 특성 11종(방어막·보호막·가시 비늘·혼신의 일격·연속 공격·흡혈·광폭화·분열·재생 의식·부활·부하 소환), 층이 깊을수록 강해짐. 다음 턴 행동은 이름 자리에 주황색 '!'로 예고.
- 던전: 미니맵 방 아이콘, 미니맵 오른쪽 아래 지도 버튼(전체 지도·순간이동), 이벤트로 공개된 방은 흐리게·연쇄 이벤트 방은 "!", 탐험 효과 태그.
  방 결과(보물·휴식·전투·이벤트)는 카드로 먼저 크게. 하단은 가방 · 캐릭터 정보(상태 이상 1턴 피해 등) · 귀환(귀환 방 미발견 시 붉은 회색).
  이동은 금색·푸른색, 귀환은 초록, 방 안 행동은 보라색. 튜토리얼 던전은 보스를 잡아도 아래층으로 못 내려가고 귀환.
- 가방·창고: 4열 격자, 종류별 색 원(무기·방어구·장신구·소모품·재료·스킬서·강화석), 장비는 등급 색 이름·착용 레벨·지금 장비 대비 수치. 칸을 누르면 화면 가운데 팝업(정보·착용/교체·사용·판매).
- 능력치 최대값: 체력·힘·민첩·지능·주문력 99, 강인함·기교 80, 정신 75, 정밀·행운 60 (최대 레벨 60).
- 던전 밖 모든 화면의 머리줄 오른쪽은 골드 + 설정 버튼.
- 특수 이벤트 34개 (기획서 v1.5: 연쇄·지도 공개·보물 더미·피의 우물·스핑크스·운명의 카드·시련의 문 등).
- 설정: 마을 오른쪽 위 톱니바퀴 → 설정 창. 기기 설정(PlayerPrefs): 전투 속도 1×/2×, 대사 한 글자씩, 진동, 글자 크기 3단계.
- 알림 점: 남은 능력치 포인트, 새 스킬, 승급 가능, 완료 퀘스트, 상점 갱신.
- 일러스트: 마을(`town.jpg`)·길드(`guild_receptionist.jpg`)·대장간(`blacksmith.jpg`)·수련장(`training.jpg`)·상점(`shop.jpg`) 적용. 나머지는 점선 상자로 표시됩니다.
  그림은 원본 비율을 유지한 채 잘라 채웁니다 (`Assets/Scripts/Editor/AssetImportRules.cs`가 2의 거듭제곱 늘림을 끄고 압축).
  대사는 일러스트 아래쪽 안에 반투명 상자로 겹쳐 보입니다.
- 새 일러스트 추가: 그림을 `Assets/Resources/Illustrations/`에 넣고 `Assets/Scripts/Game/UI/IllustrationArt.cs` 표에 한 줄 추가합니다.
- 아이콘: `Assets/Resources/Icons/` — 시설 4종, 등급 배지 8종(rank_f~rank_ss), 능력치 10종(stat_*), 강화석, 가방, 귀환, 지도, 캐릭터, 설정, 골드, 더하기, 직업 4종(job_*), 미니맵 방 8종(room_*).
- 앱 크기: 제목 글꼴(고운바탕)은 완성형 한글 2,350자 + 게임 문구만 남겨 8.2MB → 1.4MB. 이름 등 입력 글자는 전체 글꼴(나눔고딕)로 표시. IL2CPP 코드 제거(Medium)·엔진 코드 제거·ASTC 압축.

## 검증 (Unity 없이)

```bash
tools/verify/verify.sh
```

1. Core 단위 테스트 134개 (전투 400판·자동 플레이 봇 240회 던전 탐험·보스 특성·저장 왕복 포함)
2. Core를 Unity와 같은 .NET Standard 2.1 / C# 9로 컴파일
3. 전체 스크립트를 Unity 참조 어셈블리로 컴파일 (기기 빌드 조건 / 에디터 조건)

필요한 것: .NET 8 SDK, `api.nuget.org` 접속 (Unity 참조 어셈블리를 NuGet에서 내려받음).

밸런스 확인: `tools/balance/run.sh` (보통·어려움 진행 속도), `run.sh fight` (층별 전투 HP 소모), `run.sh boss` (보스 특성 켬/끔 비교).
Unity 에디터에서는 Window → General → Test Runner → EditMode에서 같은 테스트를 실행할 수 있습니다.

## 저장

- 기기의 `Application.persistentDataPath/save.json` (직전 저장은 `.bak`로 보관).
- 방을 하나 끝낼 때마다, 마을에서 행동할 때마다, 앱이 백그라운드로 갈 때 자동 저장합니다.
- 전투 중에 앱을 끄면 다시 켰을 때 그 방의 전투를 처음부터 다시 시작합니다.

## 다음 작업 후보

- 일러스트·효과음 추가
- 밸런싱 (기획서 v1.2 수치 적용, 플레이 테스트 후 조정)
- 30층 이후 확장(50층·100층, 아이템 등급 유물·고대)
- 직업별 스킬·이벤트 추가
