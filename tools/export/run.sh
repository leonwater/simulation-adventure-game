#!/usr/bin/env bash
# C# 데이터 표 → web/src/data/*.json (스킬·몬스터·소모품·이벤트·직업·밸런스 상수)
set -euo pipefail
cd "$(dirname "$0")"
dotnet run -c Release -- ../../web/src/data 2>&1 | grep -v "warning"
