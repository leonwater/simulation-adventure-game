#!/usr/bin/env bash
# 밸런스 시뮬레이션 (Unity 없이).
#   tools/balance/run.sh                 보통·어려움: 자동 플레이 봇의 진행 속도·사망률
#   tools/balance/run.sh 150 3 Hard      도전 횟수·시드 수·난이도 지정
#   tools/balance/run.sh boss 300        보스 특성 켬/끔 1:1 비교
set -euo pipefail
cd "$(dirname "$0")"
dotnet run -c Release -- "$@" 2>&1 | grep -v "warning"
