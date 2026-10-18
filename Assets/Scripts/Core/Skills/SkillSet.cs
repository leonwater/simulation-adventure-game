using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    [Serializable]
    public class SkillState
    {
        public string SkillId = "";
        /// <summary>수련 강화 단계 (0~5).</summary>
        public int Level;

        public SkillDef Def => SkillDb.Get(SkillId);
    }

    /// <summary>보유 스킬과 장착 스킬.</summary>
    [Serializable]
    public class SkillSet
    {
        public List<SkillState> Learned = new List<SkillState>();
        public List<string> Equipped = new List<string>();

        public SkillState Get(string id) => Learned.Find(s => s.SkillId == id);

        public bool Knows(string id) => Get(id) != null;

        public bool IsEquipped(string id) => Equipped.Contains(id);
    }

    /// <summary>스킬 습득·장착·수련 규칙.</summary>
    public static class SkillSystem
    {
        public static double PowerMultiplier(int level) => 1.0 + GameBalance.SkillPowerPerLevel * level;

        public static bool Learn(Character c, string skillId)
        {
            var def = SkillDb.Get(skillId);
            if (def == null || c.Skills.Knows(skillId)) return false;
            if (def.JobRestriction >= 0 && def.JobRestriction != (int)c.Job) return false;
            c.Skills.Learned.Add(new SkillState { SkillId = skillId });
            return true;
        }

        /// <summary>가방의 스킬서를 읽어 스킬을 배운다.</summary>
        public static bool UseSkillBook(Character c, string uid, out string error)
        {
            var book = c.Inventory.Find(uid);
            if (book == null || book.Kind != ItemKind.SkillBook)
            {
                error = "스킬서가 아닙니다";
                return false;
            }
            var def = SkillDb.Get(book.SkillId);
            if (def == null)
            {
                error = "알 수 없는 스킬입니다";
                return false;
            }
            if (def.JobRestriction >= 0 && def.JobRestriction != (int)c.Job)
            {
                error = Text.Of((Job)def.JobRestriction) + " 전용 스킬입니다";
                return false;
            }
            if (c.Skills.Knows(def.Id))
            {
                error = "이미 배운 스킬입니다";
                return false;
            }
            c.Inventory.Take(uid, 1);
            Learn(c, def.Id);
            error = null;
            return true;
        }

        public static string CannotEquipReason(Character c, string skillId)
        {
            var def = SkillDb.Get(skillId);
            if (def == null || !c.Skills.Knows(skillId)) return "배우지 않은 스킬입니다";
            if (c.Skills.IsEquipped(skillId)) return "이미 장착했습니다";
            if (c.Level < def.ReqLevel || c.Rank < def.ReqRank)
                return "장착 조건 Lv." + def.ReqLevel + " · " + def.ReqRank + " 등급";
            if (c.Skills.Equipped.Count >= RankSystem.SkillSlots(c.Rank)) return "장착 슬롯이 가득 찼습니다";
            return null;
        }

        /// <summary>장착 조건(레벨·등급)만 확인한다. 슬롯 여유는 보지 않는다.</summary>
        public static bool MeetsRequirement(Character c, SkillDef def) => c.Level >= def.ReqLevel && c.Rank >= def.ReqRank;

        public static bool Equip(Character c, string skillId, out string error)
        {
            error = CannotEquipReason(c, skillId);
            if (error != null) return false;
            c.Skills.Equipped.Add(skillId);
            return true;
        }

        public static bool Unequip(Character c, string skillId) => c.Skills.Equipped.Remove(skillId);

        /// <summary>수련 비용 = 200G × 다음 강화 단계. 최대 단계면 0.</summary>
        public static int TrainingCost(SkillState state) =>
            state.Level >= GameBalance.MaxSkillLevel ? 0 : GameBalance.TrainingGoldPerLevel * (state.Level + 1);

        public static bool Train(Character c, string skillId, out string error)
        {
            var state = c.Skills.Get(skillId);
            if (state == null)
            {
                error = "배우지 않은 스킬입니다";
                return false;
            }
            if (state.Level >= GameBalance.MaxSkillLevel)
            {
                error = "최대 강화 단계입니다";
                return false;
            }
            int cost = TrainingCost(state);
            if (c.Gold < cost)
            {
                error = "골드가 부족합니다";
                return false;
            }
            c.Gold -= cost;
            state.Level++;
            error = null;
            return true;
        }
    }
}
