using Adventure.Core;

namespace Adventure.Game
{
    /// <summary>빨간 알림 점 조건 (수정 사항 #23): 남은 포인트, 새 스킬, 완료 퀘스트, 상점 갱신 (승급은 v1.8부터 자동).</summary>
    public static class Alerts
    {
        private static GameSession S => GameApp.Instance.Session;

        public static bool Points => S.HasGame && S.C.UnspentPoints > 0;

        public static bool NewSkill => S.HasGame && S.HasUnseenSkill;

        public static bool QuestDone => S.HasGame && S.Data.Guild.Active.Exists(q => GuildSystem.IsComplete(q, S.C));

        /// <summary>보고할 퀘스트가 있거나, 보스를 잡아 새 층 의뢰가 붙었는데 아직 길드에 가 보지 않았을 때 (v2.3).</summary>
        public static bool Guild => QuestDone || (S.HasGame && S.GuildNewQuests);

        public static bool Shop => S.HasGame && S.ShopUnseen;

        public static bool Town => Guild || Shop;

        /// <summary>하단 메뉴 순서 (0 마을 · 1 캐릭터 · 2 가방 · 3 스킬 · 4 설정).</summary>
        public static bool Nav(int index)
        {
            switch (index)
            {
                case 0: return Town;
                case 1: return Points;
                case 3: return NewSkill;
                default: return false;
            }
        }
    }
}
