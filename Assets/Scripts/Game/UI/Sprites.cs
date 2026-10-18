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

        /// <summary>둥근 사각형 테두리만 (반투명 상자의 테두리용). 두께는 3px — 반지름 10이면 약 1.2 UI 단위.</summary>
        public static Sprite RoundedOutline
        {
            get
            {
                if (Cache.TryGetValue(-2, out var s) && s != null) return s;
                s = Create(Radius, false, 3f);
                Cache[-2] = s;
                return s;
            }
        }

        /// <summary>아래로 갈수록 진해지는 세로 그라데이션 (흰색, 색은 Image.color로).</summary>
        public static Sprite GradientUp
        {
            get
            {
                if (Cache.TryGetValue(-3, out var s) && s != null) return s;
                var tex = new Texture2D(2, 64, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "ui-gradient" };
                var px = new Color32[2 * 64];
                for (int y = 0; y < 64; y++)
                {
                    float a = 1f - y / 63f;
                    a = a * a;
                    for (int x = 0; x < 2; x++) px[y * 2 + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
                tex.SetPixels32(px);
                tex.Apply(false, true);
                s = Sprite.Create(tex, new Rect(0, 0, 2, 64), new Vector2(0.5f, 0.5f), 100f);
                Cache[-3] = s;
                return s;
            }
        }

        /// <summary>뾰족한 부분이 좌우에 있는 육각형 (보스).</summary>
        public static Sprite Hexagon
        {
            get
            {
                if (Cache.TryGetValue(-4, out var s) && s != null) return s;
                const int size = 96;
                var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "ui-hexagon" };
                var px = new Color32[size * size];
                float c = size / 2f, r = size / 2f - 1f;
                // 꼭짓점 6개 (0°, 60°, …)
                var vx = new float[6];
                var vy = new float[6];
                for (int i = 0; i < 6; i++)
                {
                    float ang = Mathf.PI / 3f * i;
                    vx[i] = c + r * Mathf.Cos(ang);
                    vy[i] = c + r * Mathf.Sin(ang);
                }
                for (int y = 0; y < size; y++)
                {
                    for (int x = 0; x < size; x++)
                    {
                        float fx = x + 0.5f, fy = y + 0.5f;
                        float inside = float.MaxValue;
                        for (int i = 0; i < 6; i++)
                        {
                            int j = (i + 1) % 6;
                            float ex = vx[j] - vx[i], ey = vy[j] - vy[i];
                            float len = Mathf.Sqrt(ex * ex + ey * ey);
                            // 변의 안쪽 방향 거리 (반시계 방향이라 왼쪽이 안쪽)
                            float d = (ex * (fy - vy[i]) - ey * (fx - vx[i])) / len;
                            inside = Mathf.Min(inside, d);
                        }
                        float a = Mathf.Clamp01(inside + 0.5f);
                        px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
                    }
                }
                tex.SetPixels32(px);
                tex.Apply(false, true);
                s = Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
                Cache[-4] = s;
                return s;
            }
        }

        /// <summary>원하는 모서리 반지름(UI 단위)에 맞는 배율.</summary>
        public static float MultiplierFor(float radius) => radius <= 0 ? 100f : Radius / radius;

        private static Sprite Create(int r, bool circle, float ring = 0)
        {
            int size = r * 2 + 2;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
            {
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear,
                name = circle ? "ui-circle" : ring > 0 ? "ui-outline" : "ui-rounded",
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
                    if (ring > 0)
                    {
                        // 가장자리까지의 거리 = r - d (가운데 2px 칸에서는 r로 충분히 멀다)
                        a *= Mathf.Clamp01(ring - (r - d) + 0.5f);
                    }
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
