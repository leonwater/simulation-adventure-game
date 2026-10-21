using System;
using System.IO;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>
    /// 기기 저장소 (Application.persistentDataPath/save.json).
    /// 임시 파일에 먼저 쓰고 바꿔 끼워 저장 도중 앱이 꺼져도 파일이 깨지지 않게 하고, 직전 저장을 .bak으로 남긴다.
    /// </summary>
    public class FileSaveStore : ISaveStore
    {
        private readonly string _path;

        public FileSaveStore(string fileName = "save.json")
        {
            _path = Path.Combine(Application.persistentDataPath, fileName);
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        [System.Runtime.InteropServices.DllImport("__Internal")]
        private static extern void AdventureSyncFs();
#endif

        /// <summary>웹 빌드에서는 쓴 파일을 브라우저 저장소에 바로 올린다 (다른 플랫폼에서는 아무 일도 하지 않는다).</summary>
        private static void Flush()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            try
            {
                AdventureSyncFs();
            }
            catch (Exception e)
            {
                Debug.LogWarning("저장 동기화 실패: " + e.Message);
            }
#endif
        }

        private string Backup => _path + ".bak";
        private string Temp => _path + ".tmp";

        public bool Exists => File.Exists(_path) || File.Exists(Backup);

        public void Write(string json)
        {
            try
            {
                File.WriteAllText(Temp, json);
                if (File.Exists(_path)) File.Copy(_path, Backup, true);
                if (File.Exists(_path)) File.Delete(_path);
                File.Move(Temp, _path);
                Flush();
            }
            catch (Exception e)
            {
                Debug.LogError("저장 실패: " + e.Message);
            }
        }

        public string Read()
        {
            try
            {
                if (File.Exists(_path))
                {
                    string text = File.ReadAllText(_path);
                    if (!string.IsNullOrWhiteSpace(text)) return text;
                }
                return File.Exists(Backup) ? File.ReadAllText(Backup) : null;
            }
            catch (Exception e)
            {
                Debug.LogError("불러오기 실패: " + e.Message);
                return null;
            }
        }

        public void Delete()
        {
            foreach (var p in new[] { _path, Backup, Temp })
            {
                try
                {
                    if (File.Exists(p)) File.Delete(p);
                }
                catch (Exception e)
                {
                    Debug.LogError("삭제 실패: " + e.Message);
                }
            }
            Flush();
        }
    }
}
