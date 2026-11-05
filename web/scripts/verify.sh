#!/usr/bin/env bash
# 빌드 전 작동 점검 전부 (play-tester 에이전트가 돌린다): 타입·테스트·빌드 → 직업 4개 튜토리얼 끝까지 → 마을 시스템 → 무작위 클릭 → 화면 틀.
# 하나라도 실패하면 멈추고 실패를 알린다. 실행: cd web && bash scripts/verify.sh
set -eo pipefail
cd "$(dirname "$0")/.."
npm run check
for job in 전사 궁수 도적 마법사; do echo "== 튜토리얼 끝까지: $job"; JOB=$job node scripts/e2e.mjs | tail -1; done
echo "== 마을 시스템"; node scripts/systems.mjs | tail -1
echo "== 무작위 클릭"; node scripts/monkey.mjs 800 1 | tail -1
echo "== 화면 틀"; node scripts/layout.mjs 360x640,390x844 | tail -1
echo "작동 점검 통과"
