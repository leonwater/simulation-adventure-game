using UnityEditor;

namespace Adventure.EditorTools
{
    /// <summary>
    /// 그림 가져오기 규칙.
    /// - 원본 비율 유지: 2의 거듭제곱 크기로 늘리지 않는다 (늘리면 화면에서 좌우로 눌려 보인다).
    /// - 앱 크기: 밉맵 없이 압축하고, 일러스트는 1024, 아이콘은 128 이하로 줄인다.
    /// </summary>
    public class AssetImportRules : AssetPostprocessor
    {
        private void OnPreprocessTexture()
        {
            bool illustration = assetPath.StartsWith("Assets/Resources/Illustrations/");
            bool icon = assetPath.StartsWith("Assets/Resources/Icons/");
            if (!illustration && !icon) return;
            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Default;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = icon;
            importer.wrapMode = UnityEngine.TextureWrapMode.Clamp;
            importer.maxTextureSize = illustration ? 1024 : 128;
            importer.textureCompression = TextureImporterCompression.Compressed;
            importer.isReadable = false;
        }
    }
}
