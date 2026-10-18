using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>
    /// 일러스트 이름 → Resources/Illustrations 파일. 그림이 칸보다 크면 Focus(0~1, 왼쪽 아래 기준) 부근을 남기고 잘라 채운다.
    /// 새 그림은 파일을 넣고 여기에 한 줄 추가하면 된다. 등록되지 않은 이름은 점선 상자로 표시된다.
    /// </summary>
    public class IllustrationArt
    {
        public string File;
        public float FocusX = 0.5f, FocusY = 0.5f;
        /// <summary>원본 가로/세로 비율. 가져오기 설정과 관계없이 원본 비율로 잘라 채운다.</summary>
        public float Aspect;

        private static readonly Dictionary<string, IllustrationArt> Table = new Dictionary<string, IllustrationArt>
        {
            // 접수원 얼굴이 위쪽 1/4 지점에 있어 위를 남긴다.
            { "길드 접수원", new IllustrationArt { File = "guild_receptionist", FocusX = 0.5f, FocusY = 0.68f, Aspect = 1.5f } },
            // 대장장이 얼굴·망치와 화로가 함께 보이도록 약간 위를 남긴다.
            { "대장장이", new IllustrationArt { File = "blacksmith", FocusX = 0.5f, FocusY = 0.62f, Aspect = 1.5f } },
            // 마을 광장: 건물 지붕과 탑이 보이도록 가운데보다 약간 위를 남긴다.
            { "마을 전경", new IllustrationArt { File = "town", FocusX = 0.5f, FocusY = 0.56f, Aspect = 1280f / 720f } },
        };

        public static IllustrationArt Find(string key)
        {
            if (string.IsNullOrEmpty(key)) return null;
            return Table.TryGetValue(key, out var art) ? art : new IllustrationArt { File = key };
        }
    }

    /// <summary>RawImage를 칸 비율에 맞춰 잘라 꽉 채운다 (CSS object-fit: cover).</summary>
    [RequireComponent(typeof(RawImage))]
    public class CoverImage : MonoBehaviour
    {
        public Vector2 Focus = new Vector2(0.5f, 0.5f);
        public float Aspect;

        private void OnEnable() => Apply();

        private void OnRectTransformDimensionsChange() => Apply();

        private void Apply()
        {
            var raw = GetComponent<RawImage>();
            if (raw == null || raw.texture == null) return;
            var size = ((RectTransform)transform).rect.size;
            if (size.x <= 0 || size.y <= 0) return;
            float texAspect = Aspect > 0 ? Aspect : (float)raw.texture.width / raw.texture.height;
            float boxAspect = size.x / size.y;
            float w = 1f, h = 1f;
            if (boxAspect > texAspect) h = texAspect / boxAspect; // 칸이 더 넓다 → 위아래를 자른다
            else w = boxAspect / texAspect;                        // 칸이 더 길다 → 좌우를 자른다
            float x = Mathf.Clamp(Focus.x - w / 2f, 0f, 1f - w);
            float y = Mathf.Clamp(Focus.y - h / 2f, 0f, 1f - h);
            raw.uvRect = new Rect(x, y, w, h);
        }
    }
}
