# 작업 규칙 (모험가 키우기)

**개발은 웹(`web/`, TypeScript)에서 하고, 앱은 Capacitor로 감싼다 (v2.5~, 자세한 내용은 `docs/WEB_PORT.md`).**
Unity 프로젝트(`Assets/`)는 `unity-v2.4` 태그로 고정된 기준용이다 — 고치지 않는다.

사용자가 따로 말하지 않아도 매번 지키는 순서:

1. 수정 사항을 모두 읽고, 기존 기획과 겹치거나 충돌하는 부분이 있으면 먼저 알린다. 사용자의 방향에 무조건 동의하지 말고, 더 나은 방법이나 고칠 점을 판단해 알린다.
2. 코드 전에 이번 버전 계획을 `docs/DEV_PLAN.md`에 적고(아이디어·후보는 대화로), 코드 작업 계획을 짠다. 기획서(Claude Docs "모험가 키우기 기획서")에는 계획·시험·후보를 적지 않는다.
3. 코딩(`web/`) → `cd web && npm run check` (타입·테스트·빌드). 화면을 바꿨으면 `npm run build`, `npm run preview &`, `npm run shot`으로 스크린샷을 찍어 직접 눈으로 확인한다.
4. 작업이 끝나면 쓸모없어진 코드를 삭제·정리하고, 앱 최적화(번들·이미지·글꼴 크기, 안 쓰는 CSS·함수)를 점검한다.
5. README·`docs/DEV_PLAN.md`·UI 시안을 갱신한다.
6. 정해지지 않은 것(사용자 결정이 필요한 질문)이 하나라도 남아 있으면 빌드를 보류한다 — main 대신 작업 브랜치에만 올리고, 모든 작업이 끝나면 그때 빌드한다.
7. main에 푸시한다 → GitHub Actions "웹 앱 빌드"가 웹 zip(`web-latest`)과 APK(`android-latest`)를 Releases에 올린다. 끝나면 링크와 크기를 알린다.
8. 빌드가 끝난 뒤에만 기획서에 **지난 빌드와 달라진 확정 내용**을 적는다 (빌드하지 않은 내용·계획·아이디어는 적지 않는다).

외부 도구 규칙:
- frontend-design · ui-ux-pro-max · hallmark · emil-design-eng · web-design-guidelines · context7 · code-review · superpowers · ponytail · security-audit · graphify · hyperframes · rea · claude-pxl을 쓸 때는 먼저 `docs/external-tools-guide.md`를 읽고 그 문서의 사용법·순서·주의를 따른다. 위 작업 순서(1~7)와 부딪히면 이 파일의 순서가 우선이다.

이식 중 규칙:
- 이식이 끝난 부분은 TS에만 고친다. 아직 이식 안 된 부분을 바꿔야 하면 먼저 그 부분을 이식한다 (이식 순서: `docs/WEB_PORT.md`).
- 데이터 표 `web/src/data/*.json`은 v2.6부터 웹 JSON이 원본이다 (직접 고친다). 직업·스킬 요약은 `docs/JOBS_SKILLS.md` — 표를 바꾸면 함께 고친다.
- 서명 키·비밀번호는 저장소에 넣지 않는다.

답변은 간단명료한 한국어로 한다.
