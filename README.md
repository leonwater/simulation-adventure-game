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

## 프로젝트 구조

| 경로 | 내용 |
| --- | --- |
| `Assets/Scripts/Core` | 순수 C# 게임 로직 (Unity 참조 없음). 캐릭터·아이템·마을·던전·전투·저장 |
| `Assets/Scripts/Core/GameBalance.cs` | **모든 밸런스 수치(임시값)를 모아 둔 파일** |
| `Assets/Scripts/Game` | Unity 실행부: 부트스트랩(`GameApp`), UI 도구(`UI/`), 화면(`Screens/`), 파일 저장 |
| `Assets/Scripts/Editor` | 프로젝트 자동 설정 |
| `Assets/Tests/EditMode` | NUnit 테스트 87개 (Unity Test Runner와 `dotnet test` 양쪽에서 실행) |
| `Assets/Resources/Fonts` | 나눔고딕·고운바탕 (SIL OFL 1.1) |
| `tools/verify` | Unity 없이 검증하는 스크립트 |
| `docs/DEV_PLAN.md` | 작업 기획 (파트 구성, 임시로 정한 규칙) |

## 화면 (UI 시안 기준)

새 게임 · 마을 · 길드(퀘스트·등급·창고) · 상점 · 대장간 · 수련장 · 캐릭터 · 가방·장비 · 스킬 · 설정 ·
던전 탐험(미니맵) · 전투 · 특수 이벤트 · 정산(사망·귀환·엔딩)

- 일러스트: 길드(`guild_receptionist.jpg`)·대장간(`blacksmith.jpg`) 적용. 나머지는 시안처럼 점선 상자로 표시됩니다.
- 새 일러스트 추가: 그림을 `Assets/Resources/Illustrations/`에 넣고 `Assets/Scripts/Game/UI/IllustrationArt.cs` 표에 한 줄 추가합니다.
  (화면에 보이는 `[일러스트: 상점 주인]`의 이름 → 파일 이름, 잘라낼 때 남길 위치). 그림은 칸 비율에 맞게 잘려 꽉 채워집니다.

## 검증 (Unity 없이)

```bash
tools/verify/verify.sh
```

1. Core 단위 테스트 87개 (전투 400판·자동 플레이 봇 240회 던전 탐험·저장 왕복 포함)
2. Core를 Unity와 같은 .NET Standard 2.1 / C# 9로 컴파일
3. 전체 스크립트를 Unity 참조 어셈블리로 컴파일 (기기 빌드 조건 / 에디터 조건)

필요한 것: .NET 8 SDK, `api.nuget.org` 접속 (Unity 참조 어셈블리를 NuGet에서 내려받음).
Unity 에디터에서는 Window → General → Test Runner → EditMode에서 같은 테스트를 실행할 수 있습니다.

## 저장

- 기기의 `Application.persistentDataPath/save.json` (직전 저장은 `.bak`로 보관).
- 방을 하나 끝낼 때마다, 마을에서 행동할 때마다, 앱이 백그라운드로 갈 때 자동 저장합니다.
- 전투 중에 앱을 끄면 다시 켰을 때 그 방의 전투를 처음부터 다시 시작합니다.

## 다음 작업 후보

- 일러스트·효과음 추가
- 밸런싱 (자동 플레이 봇 기준 전사가 다른 직업보다 진행이 느림)
- 30층 이후 확장(50층·100층, 아이템 등급 유물·고대)
- 직업별 스킬·이벤트 추가
