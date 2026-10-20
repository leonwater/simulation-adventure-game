using System;
using Adventure.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>
    /// 앱 시작점. 씬에 아무것도 없어도 실행 시 자동으로 만들어지며, 카메라·캔버스·화면 전환을 모두 코드로 구성한다.
    /// </summary>
    public class GameApp : MonoBehaviour
    {
        public static GameApp Instance { get; private set; }

        public GameSession Session { get; private set; }
        public Router Router { get; private set; }
        public Overlay Overlay { get; private set; }

        private float _playTime;
        private bool _legacyInput = true;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (Instance != null) return;
            var go = new GameObject("GameApp");
            DontDestroyOnLoad(go);
            go.AddComponent<GameApp>();
        }

        private void Start()
        {
            // 예전 버전에서 이미 튜토리얼을 마친 기기: 건너뛰기를 보여 준다
            var save = Session.PeekSave();
            if (save != null && save.Tutorial == TutorialStage.Done) GameSettings.TutorialCompleted = true;
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            Application.targetFrameRate = 60;
            Input.multiTouchEnabled = false;

            EnsureCamera();
            EnsureEventSystem();
            BuildCanvas(out var screens, out var overlay);
            Router = new Router(screens);
            Overlay = new Overlay(overlay);
            Session = new GameSession(new FileSaveStore());
            Router.Show(new TitleScreen());
        }

        private void EnsureCamera()
        {
            if (Camera.main != null) return;
            var cam = new GameObject("Main Camera").AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Theme.Page;
            cam.orthographic = true;
            cam.cullingMask = 0;
            DontDestroyOnLoad(cam.gameObject);
        }

        private void EnsureEventSystem()
        {
            if (FindAnyEventSystem() != null) return;
            var es = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            DontDestroyOnLoad(es);
        }

        private static EventSystem FindAnyEventSystem() => EventSystem.current;

        private void BuildCanvas(out RectTransform screens, out RectTransform overlay)
        {
            var go = new GameObject("Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            go.transform.SetParent(transform, false);
            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.pixelPerfect = false;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(Theme.ScreenWidth, Theme.ScreenHeight);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0f; // 폭 390 고정, 세로는 기기에 따라 늘어난다
            scaler.referencePixelsPerUnit = 100f;

            var page = UI.Image(go.transform, Theme.Page, 0, "page");
            UI.Stretch(page.rectTransform);

            var safe = UI.Rect(go.transform, "safe-area");
            UI.Stretch(safe);
            safe.gameObject.AddComponent<SafeArea>();

            screens = UI.Rect(safe, "screens");
            UI.Stretch(screens);
            overlay = UI.Rect(safe, "overlay");
            UI.Stretch(overlay);
            var coach = UI.Rect(safe, "coach"); // 튜토리얼 강조 표시는 팝업보다 위
            UI.Stretch(coach);
            Coach.Init(coach);
        }

        private void Update()
        {
            if (Session != null && Session.HasGame)
            {
                _playTime += Time.unscaledDeltaTime;
                if (_playTime >= 1f)
                {
                    Session.Data.PlaySeconds += (long)_playTime;
                    _playTime -= (long)_playTime;
                }
            }
            if (BackPressed()) HandleBack();
            if (Session != null && Session.Promotions.Count > 0) TryShowPromotion();
        }

        /// <summary>
        /// 자동 승급 알림 (v1.8). 다른 창·튜토리얼 강조가 없고 전투 연출 중이 아닐 때 하나씩 띄운다.
        /// 배지 효과·스킬 칸·창고 칸은 승급하는 순간 이미 적용되어 있다.
        /// </summary>
        private void TryShowPromotion()
        {
            if (Coach.Active || Overlay.Top != null || Router.Current is BattleScreen || Router.Current is TitleScreen) return;
            var rank = Session.Promotions[0];
            Session.Promotions.RemoveAt(0);
            var body = Overlay.Modal("등급 승급", false, false, showClose: false);
            var modal = Overlay.Top;
            UI.CenteredIcon(body, UI.RankIcon(rank), 96);
            UI.Label(body, rank + " 등급 모험가가 되었습니다!", 18, Theme.Gold, true, TextAnchor.MiddleCenter);
            UI.Label(body, "배지 효과 · 기본 능력치 +" + Mathf.RoundToInt((float)RankSystem.BadgeBonus(rank) * 100) + "%\n스킬 " + RankSystem.SkillSlots(rank)
                           + "칸 · 창고 " + RankSystem.StorageCapacity(rank) + "칸", 14, Theme.Text, false, TextAnchor.MiddleCenter);
            UI.TextButton(body, "확인", () =>
            {
                Overlay.Close(modal);
                Router.Rebuild(); // 머리줄 배지·능력치를 새 등급으로
            }, ButtonKind.Primary);
        }

        private bool BackPressed()
        {
            if (!_legacyInput) return false;
            try
            {
                return Input.GetKeyDown(KeyCode.Escape);
            }
            catch (InvalidOperationException)
            {
                // 프로젝트가 새 Input System만 쓰도록 설정된 경우
                _legacyInput = false;
                return false;
            }
        }

        private void HandleBack()
        {
            // 튜토리얼 강조 중이거나 마을·귀환 안내 중에는 말풍선의 버튼으로만 넘어간다
            if (Coach.Active || (Tutorial.Running && !Session.InDungeon)) return;
            if (Overlay.CloseTop()) return;
            if (Router.Current != null && Router.Current.OnBack()) return;
            if (Router.Current is TitleScreen || Router.Current is TownScreen)
                Overlay.Confirm("게임 종료", "게임을 종료할까요? 진행 상황은 자동으로 저장됩니다.", "종료", Quit);
        }

        public void Quit()
        {
            Session?.Save();
            Application.Quit();
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused) Session?.Save();
        }

        private void OnApplicationQuit()
        {
            Session?.Save();
        }

        // ── 화면 이동 공통 ────────────────────────────────────

        /// <summary>지금 게임 상태에 맞는 화면으로 간다 (던전 안이면 전투·이벤트·탐험, 아니면 마을).</summary>
        public void GoToCurrent()
        {
            if (!Session.HasGame)
            {
                Router.Show(new TitleScreen());
                return;
            }
            if (!Session.InDungeon)
            {
                Router.Show(new TownScreen());
                return;
            }
            if (Session.Battle != null) Router.Show(new BattleScreen());
            else if (Session.PendingEvent != null) Router.Show(new EventScreen());
            else Router.Show(new DungeonScreen());
        }
    }
}
