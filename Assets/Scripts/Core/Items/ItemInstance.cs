using System;

namespace Adventure.Core
{
    /// <summary>
    /// 아이템 한 칸. 생성 시점의 수치를 그대로 들고 있어 저장·불러오기가 단순하다.
    /// 소모품·재료·강화석·스킬서는 같은 TemplateId끼리 겹친다.
    /// </summary>
    [Serializable]
    public class ItemInstance
    {
        public string Uid = "";
        public string TemplateId = "";
        public ItemKind Kind;
        public string Name = "";
        public ItemGrade Grade;
        public GearType Gear;
        /// <summary>무기 = 공격력, 방어구 = 방어력, 장신구 = 능력치 고정 보너스 (강화 전).</summary>
        public int BaseValue;
        public Stat BonusStat;
        public int LevelReq = 1;
        /// <summary>-1 = 공용, 그 외 = (int)Job.</summary>
        public int JobRestriction = -1;
        public int Enhance;
        public int Count = 1;
        /// <summary>1개 기준 구매 가격.</summary>
        public int Price;
        public string SkillId = "";

        public bool IsStackable => Kind != ItemKind.Equipment;

        public bool IsWeapon => Kind == ItemKind.Equipment && Gear == GearType.Weapon;

        public bool IsAccessory => Kind == ItemKind.Equipment && (Gear == GearType.Necklace || Gear == GearType.Ring);

        /// <summary>강화가 반영된 수치. 강화 1단계마다 기본 수치 + 등급별 2~4% (무기·방어구 최소 +1, 장신구 2단계마다 최소 +1).</summary>
        public int Value => ValueAt(Enhance);

        public int ValueAt(int enhance)
        {
            int bonus = (int)Math.Round(BaseValue * GameBalance.EnhanceValuePerLevel[(int)Grade] * enhance);
            int min = IsAccessory ? (enhance + 1) / 2 : enhance;
            return BaseValue + Math.Max(bonus, min);
        }

        /// <summary>판매가 = 구매가의 50% + 강화에 든 골드의 50%.</summary>
        public int SellPrice => Math.Max(1, (int)Math.Round(Price * GameBalance.SellRatio + Blacksmith.GoldSpent(this) * GameBalance.EnhanceSellRefund));

        public string DisplayName => Enhance > 0 ? Name + " +" + Enhance : Name;

        public bool CanBeUsedBy(Job job) => JobRestriction < 0 || JobRestriction == (int)job;

        public static string NewUid() => Guid.NewGuid().ToString("N").Substring(0, 16);

        public ItemInstance CloneWithCount(int count)
        {
            var copy = (ItemInstance)MemberwiseClone();
            copy.Uid = NewUid();
            copy.Count = count;
            return copy;
        }

        /// <summary>장비 정보 한 줄 (예: "공격력 64 · Lv.12 · 전사 전용").</summary>
        public string StatLine()
        {
            switch (Kind)
            {
                case ItemKind.Equipment:
                    string main;
                    if (IsWeapon) main = "공격력 " + Value;
                    else if (IsAccessory) main = Names.Of(BonusStat) + " +" + Value;
                    else main = "방어력 " + Value;
                    string job = JobRestriction < 0 ? "공용" : Names.Of((Job)JobRestriction) + " 전용";
                    return main + " · Lv." + LevelReq + " · " + job;
                case ItemKind.Consumable:
                    return ItemDb.Consumable(TemplateId)?.Description ?? "";
                case ItemKind.SkillBook:
                    var skill = SkillDb.Get(SkillId);
                    return skill == null ? "" : Names.Of(skill.Tier) + " 스킬 · " + skill.Description;
                case ItemKind.EnhanceStone:
                    return "대장간 +6 이상 강화 재료";
                default:
                    return "기타 · 퀘스트 납품이나 판매에 쓴다";
            }
        }
    }
}
