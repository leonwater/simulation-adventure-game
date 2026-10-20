using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Adventure.EditorTools
{
    /// <summary>
    /// 저장소를 처음 열었을 때 프로젝트를 자동으로 설정한다.
    /// - Assets/Scenes/Main.unity 생성 (카메라만 있는 빈 씬. 게임은 실행 시 코드로 만들어진다)
    /// - 빌드 씬 등록, 앱 이름·회사·패키지 이름, 세로 화면 고정
    /// 메뉴 "모험가 키우기 > 프로젝트 설정 다시 적용"으로 언제든 다시 실행할 수 있다.
    /// </summary>
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        private const string ScenePath = "Assets/Scenes/Main.unity";
        private const string ProductName = "모험가 키우기";
        private const string CompanyName = "leonwater";
        private const string BundleId = "com.leonwater.adventurer";

        static ProjectSetup()
        {
            EditorApplication.delayCall += () =>
            {
                // CI(배치 모드)에서는 CIBuild가 직접 설정한다.
                if (Application.isBatchMode || EditorApplication.isPlayingOrWillChangePlaymode) return;
                if (!File.Exists(ScenePath)) Apply();
            };
        }

        [MenuItem("모험가 키우기/프로젝트 설정 다시 적용")]
        public static void Apply()
        {
            CreateSceneIfMissing();
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

            PlayerSettings.productName = ProductName;
            PlayerSettings.companyName = CompanyName;
#if UNITY_2021_2_OR_NEWER
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android, BundleId);
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.iOS, BundleId);
#else
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, BundleId);
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.iOS, BundleId);
#endif
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;
            PlayerSettings.runInBackground = false;
            // 모든 화면 비율 (v1.8): 20:9·21:9 같은 긴 휴대폰과 폴더블 바깥 화면(약 23:9)도 위아래 검은 띠 없이 채우고,
            // 노치 영역까지 그린 뒤 게임 안(ScreenFit)에서 안전 영역을 피한다. 폴더블·멀티 윈도로 크기가 바뀌어도 다시 맞춘다.
            PlayerSettings.Android.maxAspectRatio = 2.8f;
            PlayerSettings.Android.renderOutsideSafeArea = true;
            // Unity 버전마다 이름이 달라 있으면 켠다 (Android "resizeableActivity")
            foreach (var name in new[] { "resizeableActivity", "resizableWindow" })
            {
                var prop = typeof(PlayerSettings.Android).GetProperty(name, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                if (prop == null || !prop.CanWrite || prop.PropertyType != typeof(bool)) continue;
                prop.SetValue(null, true);
                break;
            }
            AssetDatabase.SaveAssets();
            Debug.Log("[모험가 키우기] 프로젝트 설정 완료: " + ScenePath + " · 세로 화면 · " + BundleId);
        }

        private static void CreateSceneIfMissing()
        {
            if (File.Exists(ScenePath)) return;
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var cam = new GameObject("Main Camera").AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.059f, 0.067f, 0.082f);
            cam.orthographic = true;
            cam.cullingMask = 0;
            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.Refresh();
        }

        [MenuItem("모험가 키우기/저장 파일 폴더 열기")]
        public static void OpenSaveFolder() => EditorUtility.RevealInFinder(Application.persistentDataPath);

        [MenuItem("모험가 키우기/저장 파일 삭제")]
        public static void DeleteSave()
        {
            foreach (var name in new[] { "save.json", "save.json.bak", "save.json.tmp" })
            {
                var p = Path.Combine(Application.persistentDataPath, name);
                if (File.Exists(p)) File.Delete(p);
            }
            Debug.Log("[모험가 키우기] 저장 파일을 삭제했습니다.");
        }
    }
}
