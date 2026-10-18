using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>화면 하나. Build에서 UI를 전부 새로 만든다 (상태가 바뀌면 Rebuild).</summary>
    public abstract class ScreenBase
    {
        protected GameApp App => GameApp.Instance;
        protected GameSession S => App.Session;
        protected Character C => App.Session.C;
        protected Overlay Overlay => App.Overlay;

        public abstract void Build(RectTransform root);

        /// <summary>안드로이드 뒤로 가기. 처리했으면 true.</summary>
        public virtual bool OnBack() => false;

        protected void Rebuild() => App.Router.Rebuild();

        protected void Go(ScreenBase screen) => App.Router.Show(screen);

        protected void Toast(string message) => Overlay.Toast(message);
    }

    public class Router
    {
        private readonly RectTransform _layer;

        public ScreenBase Current { get; private set; }

        public Router(RectTransform layer)
        {
            _layer = layer;
        }

        public void Show(ScreenBase screen)
        {
            GameApp.Instance.Overlay.CloseAll();
            Current = screen;
            Rebuild();
        }

        public void Rebuild()
        {
            UI.Clear(_layer);
            var root = UI.Rect(_layer, Current.GetType().Name);
            UI.Stretch(root);
            var bg = UI.Image(root, Theme.Bg, 0, "background");
            UI.Stretch(bg.rectTransform);
            Current.Build(root);
        }
    }
}
