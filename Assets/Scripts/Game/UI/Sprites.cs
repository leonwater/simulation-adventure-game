using System.Collections.Generic;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>둥근 모서리용 9분할 스프라이트를 코드로 만든다 (이미지 파일 없이 동작).</summary>
    public static class Sprites
    {
        private const int Radius = 24;
        private static readonly Dictionary<int, Sprite> Cache = new Dictionary<int, Sprite>();

        /// <summary>radius px 둥근 사각형. Image.pixelsPerUnitMultiplier와 함께 쓴다.</summary>
        public static Sprite Rounded
        {
            get
            {
                if (Cache.TryGetValue(Radius, out var s) && s != null) return s;
                s = Create(Radius, false);
                Cache[Radius] = s;
                return s;
            }
        }

        public static Sprite Circle
        {
            get
            {
                if (Cache.TryGetValue(-1, out var s) && s != null) return s;
                s = Create(Radius, true);
                Cache[-1] = s;
                return s;
            }
        }

        /// <summary>원하는 모서리 반지름(UI 단위)에 맞는 배율.</summary>
        public static float MultiplierFor(float radius) => radius <= 0 ? 100f : Radius / radius;

        private static Sprite Create(int r, bool circle)
        {
            int size = r * 2 + 2;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
            {
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear,
                name = circle ? "ui-circle" : "ui-rounded",
            };
            var px = new Color32[size * size];
            float c = size / 2f;
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    // 모서리 원 중심까지의 거리로 안티에일리어싱
                    float fx = x + 0.5f, fy = y + 0.5f;
                    float cx = Mathf.Clamp(fx, r, size - r);
                    float cy = Mathf.Clamp(fy, r, size - r);
                    if (circle)
                    {
                        cx = c;
                        cy = c;
                    }
                    float d = Mathf.Sqrt((fx - cx) * (fx - cx) + (fy - cy) * (fy - cy));
                    float a = Mathf.Clamp01(r - d + 0.5f);
                    px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            }
            tex.SetPixels32(px);
            tex.Apply(false, true);
            var border = circle ? Vector4.zero : new Vector4(r, r, r, r);
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, border);
        }
    }
}
