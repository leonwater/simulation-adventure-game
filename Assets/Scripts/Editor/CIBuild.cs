using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Adventure.EditorTools
{
    /// <summary>
    /// GitHub Actions(GameCI)에서 부르는 빌드 진입점.
    /// game-ci/unity-builder가 넘겨주는 -customBuildPath, -androidVersionCode, -buildVersion 인자를 읽는다.
    /// </summary>
    public static class CIBuild
    {
        public static void BuildAndroid()
        {
            string output = Arg("-customBuildPath") ?? "build/Android/adventurer.apk";
            int versionCode = int.TryParse(Arg("-androidVersionCode"), out int vc) && vc > 0 ? vc : 1;
            string version = Arg("-buildVersion");
            if (string.IsNullOrEmpty(version) || version == "none") version = "0.1." + versionCode;

            ProjectSetup.Apply();

            PlayerSettings.bundleVersion = version;
            PlayerSettings.Android.bundleVersionCode = versionCode;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
#if UNITY_2021_2_OR_NEWER
            PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            // 앱 크기 줄이기: 쓰지 않는 코드 제거 (저장 파일이 리플렉션으로 쓰는 Core는 link.xml로 보존)
            PlayerSettings.SetManagedStrippingLevel(UnityEditor.Build.NamedBuildTarget.Android, ManagedStrippingLevel.Medium);
#else
            PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetManagedStrippingLevel(BuildTargetGroup.Android, ManagedStrippingLevel.Medium);
#endif
            PlayerSettings.stripEngineCode = true;
            EditorUserBuildSettings.androidBuildSubtarget = MobileTextureSubtarget.ASTC;
            EditorUserBuildSettings.buildAppBundle = false; // .aab가 아니라 바로 설치할 수 있는 .apk

            ApplyKeystoreFromArgs();

            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output)));
            var options = new BuildPlayerOptions
            {
                scenes = new[] { "Assets/Scenes/Main.unity" },
                locationPathName = output,
                target = BuildTarget.Android,
                options = BuildOptions.None,
            };
            Debug.Log("[CIBuild] Android 빌드 시작: " + output + " (버전 " + version + ", 코드 " + versionCode + ")");
            BuildReport report = BuildPipeline.BuildPlayer(options);
            var summary = report.summary;
            Debug.Log("[CIBuild] 결과: " + summary.result + ", 크기 " + summary.totalSize / (1024 * 1024) + "MB, 오류 " + summary.totalErrors);
            if (summary.result != BuildResult.Succeeded) EditorApplication.Exit(1);
        }

        /// <summary>
        /// 선택 사항: 워크플로에 키스토어 비밀값이 있으면 GameCI가 키스토어 파일을 프로젝트에 쓰고
        /// -androidKeystoreName 등 인자를 넘겨 준다. 없으면 빌드마다 새 디버그 키로 서명되어,
        /// 업데이트할 때 기존 앱을 지우고 설치해야 한다.
        /// </summary>
        private static void ApplyKeystoreFromArgs()
        {
            string name = Arg("-androidKeystoreName");
            string pass = Arg("-androidKeystorePass");
            if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(pass) || !File.Exists(name))
            {
                PlayerSettings.Android.useCustomKeystore = false;
                Debug.Log("[CIBuild] 키스토어 없음: 디버그 키로 서명합니다.");
                return;
            }
            PlayerSettings.Android.useCustomKeystore = true;
            PlayerSettings.Android.keystoreName = Path.GetFullPath(name);
            PlayerSettings.Android.keystorePass = pass;
            PlayerSettings.Android.keyaliasName = Arg("-androidKeyaliasName") ?? "";
            PlayerSettings.Android.keyaliasPass = Arg("-androidKeyaliasPass") ?? "";
            Debug.Log("[CIBuild] 고정 키스토어로 서명합니다.");
        }

        private static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == name && !args[i + 1].StartsWith("-")) return args[i + 1];
            return null;
        }
    }
}
