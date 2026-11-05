# 작업 규칙 (모험가 키우기)

**개발은 웹(`web/`, TypeScript)에서 하고, 앱은 Capacitor로 감싼다 (v2.5~, 자세한 내용은 `docs/WEB_PORT.md`).**
Unity 프로젝트(`Assets/`)는 `unity-v2.4` 태그로 고정된 기준용이다 — 고치지 않는다.

사용자가 따로 말하지 않아도 매번 지키는 순서:

1. 수정 사항을 모두 읽고, 기존 기획과 겹치거나 충돌하는 부분이 있으면 먼저 알린다. 사용자의 방향에 무조건 동의하지 말고, 더 나은 방법이나 고칠 점을 판단해 알린다.
2. 코드 전에 이번 버전 계획을 `docs/DEV_PLAN.md`에 적고(아이디어·후보는 대화로), 코드 작업 계획을 짠다. 기획서(Claude Docs "모험가 키우기 기획서")에는 계획·시험·후보를 적지 않는다.
3. 코딩(`web/`) → `cd web && npm run check` (타입·테스트·빌드). 화면을 바꿨으면 `npm run build`, `npm run preview &`, `npm run shot`으로 스크린샷을 찍어 직접 눈으로 확인한다.
   - 규칙·이름·수치를 바꾸면 그것을 설명하는 다른 글(튜토리얼 말풍선·팁·상세창·도움말)과 화면 코드가 덮어쓰는 곳을 `grep`으로 모두 찾아 함께 고친다 (v3.15: 화면이 '에너지 볼'을 '공격'으로 덮어씀, '길게 누르기 금지'와 '길게 누르면 볼 수 있어요' 안내가 충돌).
   - 직업마다 다른 기능은 그 직업으로, 튜토리얼 안/밖이 다른 기능은 둘 다 확인한다.
4. 작업이 끝나면 쓸모없어진 코드를 삭제·정리하고, 앱 최적화(번들·이미지·글꼴 크기, 안 쓰는 CSS·함수)를 점검한다. **빌드할 때마다 빌드 전에 코드 정리를 반드시 한다**: 아무 데도 안 쓰는 함수·내보내기·CSS 클래스·그림(이펙트 그림 묶음 포함)·파일·스크립트·패키지를 찾아 지운다. 정리를 빠뜨리고 빌드했으면 정리한 뒤 다시 빌드한다.
5. **빌드 전 작동 점검**: 코드 정리가 끝나면 `play-tester` 에이전트(`.claude/agents/play-tester.md`)를 실행한다. 에이전트가 `web/scripts/verify.sh`(타입·테스트·빌드, 직업 4개 튜토리얼 끝까지, 마을 시스템, 무작위 클릭, 화면 틀)를 돌리고, `docs/DEV_PLAN.md` 이번 절의 요청 표를 항목마다 실제 화면에서 확인해 통과/실패를 보고한다. 실패가 하나라도 있으면 고친 뒤 다시 실행하고, 모두 통과해야 빌드한다. 점검 스크립트가 화면 변경으로 고장 나면 그때 바로 고친다.
6. README·`docs/DEV_PLAN.md`·UI 시안을 갱신한다.
7. 정해지지 않은 것(사용자 결정이 필요한 질문)이 하나라도 남아 있으면 빌드를 보류한다 — main 대신 작업 브랜치에만 올리고, 모든 작업이 끝나면 그때 빌드한다.
8. main에 푸시한다 → GitHub Actions "웹 앱 빌드"가 웹 zip(`web-latest`)과 APK(`android-latest`)를 Releases에 올린다. 끝나면 링크와 크기를 알린다. **빌드할 때마다 깃허브도 정리한다**: main에 다 합친 작업 브랜치 삭제, 안 합친 브랜치는 `archive/<이름>` 태그로 보관한 뒤 삭제(지우기 전에 알림), 빌드가 더는 만들지 않는 예전 릴리스·태그 삭제, `unity-v2.4` 태그는 남긴다.
   - 저장소가 비공개라 Releases 링크는 다른 사람에게 열리지 않는다. 남에게 줄 웹 플레이 링크는 claude.ai 아티팩트 https://claude.ai/artifact/63TPyXbWy8hFLEyR9Yf7ro 이다: `npm run build` 뒤 `web/dist/index.html`의 `<head>` 안 title·icon·css·script 줄과 `<div id="app">`만 담은 `web/dist/play.html`을 만들어, 같은 주소로 dist 파일 전부(`files`, root `web/dist`)와 함께 다시 올린다.
9. **작업이 끝날 때마다** 기획서에 지난 빌드와 달라진 내용을 적고, 기획서 링크(https://claude.ai/artifact/DD3wdsXQTFkDUYBMQbgTAn)를 채팅에 함께 보낸다. 빌드하지 않은 작업은 '(빌드 전)'으로 표시하고, 빌드한 뒤 '(빌드)'로 바꿔 확정한다. 계획·아이디어·후보는 적지 않는다 (요청받아 코드에 반영한 것만).

외부 도구 규칙:
- frontend-design · ui-ux-pro-max · hallmark · emil-design-eng · web-design-guidelines · context7 · code-review · superpowers · ponytail · security-audit · graphify · hyperframes · rea · claude-pxl을 쓸 때는 먼저 `docs/external-tools-guide.md`를 읽고 그 문서의 사용법·순서·주의를 따른다. 위 작업 순서(1~9)와 부딪히면 이 파일의 순서가 우선이다.

이식 중 규칙:
- 이식이 끝난 부분은 TS에만 고친다. 아직 이식 안 된 부분을 바꿔야 하면 먼저 그 부분을 이식한다 (이식 순서: `docs/WEB_PORT.md`).
- 데이터 표 `web/src/data/*.json`은 v2.6부터 웹 JSON이 원본이다 (직접 고친다). 직업·스킬 요약은 `docs/JOBS_SKILLS.md` — 표를 바꾸면 함께 고친다.
- 서명 키·비밀번호는 저장소에 넣지 않는다.

답변은 간단명료한 한국어로 한다.
