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
        // 규칙을 바꾸면 올려서 캐시된 그림도 다시 가져오게 한다
        public override uint GetVersion() => 2;

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
            // 안드로이드는 ASTC로 확실히 압축한다 (자동 형식은 2의 거듭제곱이 아닌 그림을 압축하지 않고 넣었다)
            importer.SetPlatformTextureSettings(new TextureImporterPlatformSettings
            {
                name = "Android",
                overridden = true,
                maxTextureSize = illustration ? 1024 : 128,
                format = illustration ? TextureImporterFormat.ASTC_6x6 : TextureImporterFormat.ASTC_4x4,
                compressionQuality = 50,
            });
        }
    }
}
