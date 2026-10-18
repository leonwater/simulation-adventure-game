#!/usr/bin/env bash
# Unity 없이 프로젝트를 검증한다.
#  1) Core 단위 테스트 (NUnit)
#  2) Core를 netstandard2.1 / C# 9 로 컴파일 (Unity 호환 범위 확인)
#  3) 전체 스크립트를 Unity 참조 어셈블리로 컴파일 (Player, Editor 두 조건)
# 필요: .NET 8 SDK, api.nuget.org 접근
set -euo pipefail
cd "$(dirname "$0")"

REF=.cache/unity-ref
if [ ! -f "$REF/UnityEngine.CoreModule.dll" ] || [ ! -f "$REF/UnityEngine.UI.dll" ] || [ ! -f "$REF/UnityEditor.dll" ]; then
  echo "== Unity 참조 어셈블리 내려받기 (NuGet)"
  mkdir -p .cache/pkgs "$REF"
  fetch() { curl -sSfL -o ".cache/pkgs/$1.nupkg" "https://api.nuget.org/v3-flatcontainer/$1/$2/$1.$2.nupkg"; }
  fetch unityengine.modules 2021.3.33
  fetch unity3d.sdk 2021.1.14.1
  fetch unity3d.unityengine.ui 2020.3.21
  unzip -o -q -j .cache/pkgs/unityengine.modules.nupkg 'lib/netstandard2.0/*' -d "$REF"
  unzip -o -q -j .cache/pkgs/unity3d.sdk.nupkg lib/UnityEditor.dll -d "$REF"
  unzip -o -q -j .cache/pkgs/unity3d.unityengine.ui.nupkg lib/UnityEngine.UI.dll -d "$REF"
fi

echo "== 1/4 Core 단위 테스트"
dotnet test CoreTests/CoreTests.csproj --nologo -v q
echo "== 2/4 Core 호환성 컴파일 (netstandard2.1, C# 9)"
dotnet build CoreCheck/CoreCheck.csproj --nologo -v q
echo "== 3/4 Unity 컴파일 (Player)"
dotnet build UnityCheck/UnityCheck.csproj --nologo -v q -p:Mode=Player
echo "== 4/4 Unity 컴파일 (Editor)"
dotnet build UnityCheck/UnityCheck.csproj --nologo -v q -p:Mode=Editor
echo "== 모든 검증 통과"
