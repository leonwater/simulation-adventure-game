using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    public sealed class ConsumableDef
    {
        public string Id;
        public string Name;
        public int Price;
        /// <summary>최대 HP 대비 회복 비율.</summary>
        public double HealRatio;
        /// <summary>해제하는 디버프. 없으면 null.</summary>
        public StatusType? Cures;
        public string Description;
        /// <summary>상점·상인 판매 여부.</summary>
        public bool SoldInShop = true;
    }

    public sealed class MaterialDef
    {
        public string Id;
        public string Name;
        public int Price;
    }

    /// <summary>소모품·재료·강화석·스킬서·장비 생성.</summary>
    public static class ItemDb
    {
        public const string EnhanceStoneId = "stone";

        public static readonly ConsumableDef[] Consumables =
        {
            new ConsumableDef { Id = "potion", Name = "회복 물약", Price = 50, HealRatio = 0.30, Description = "최대 HP의 30% 회복" },
            new ConsumableDef { Id = "potion_hi", Name = "고급 회복 물약", Price = 160, HealRatio = 0.60, Description = "최대 HP의 60% 회복" },
            new ConsumableDef { Id = "antidote", Name = "해독제", Price = 40, Cures = StatusType.Poison, Description = "독 해제" },
            new ConsumableDef { Id = "bandage", Name = "붕대", Price = 40, Cures = StatusType.Bleed, Description = "출혈 해제" },
            new ConsumableDef { Id = "salve", Name = "화상 연고", Price = 40, Cures = StatusType.Burn, Description = "화상 해제" },
        };

        private static readonly Dictionary<string, MaterialDef> Materials = new Dictionary<string, MaterialDef>();

        static ItemDb()
        {
            foreach (var m in MonsterDb.AllSpecies)
                if (!string.IsNullOrEmpty(m.MaterialId) && !Materials.ContainsKey(m.MaterialId))
                    Materials[m.MaterialId] = new MaterialDef { Id = m.MaterialId, Name = m.MaterialName, Price = 6 + Math.Max(0, m.Tier) * 10 };
        }

        public static ConsumableDef Consumable(string id) => Array.Find(Consumables, c => c.Id == id);

        public static MaterialDef Material(string id) => Materials.TryGetValue(id, out var m) ? m : null;

        public static ItemInstance CreateConsumable(string id, int count = 1)
        {
            var def = Consumable(id);
            if (def == null) throw new ArgumentException("unknown consumable " + id);
            return new ItemInstance
            {
                Uid = ItemInstance.NewUid(), TemplateId = def.Id, Kind = ItemKind.Consumable,
                Name = def.Name, Count = count, Price = def.Price,
            };
        }

        public static ItemInstance CreateMaterial(string id, int count = 1)
        {
            var def = Material(id);
            if (def == null) throw new ArgumentException("unknown material " + id);
            return new ItemInstance
            {
                Uid = ItemInstance.NewUid(), TemplateId = def.Id, Kind = ItemKind.Material,
                Name = def.Name, Count = count, Price = def.Price,
            };
        }

        public static ItemInstance CreateEnhanceStone(int count = 1) => new ItemInstance
        {
            Uid = ItemInstance.NewUid(), TemplateId = EnhanceStoneId, Kind = ItemKind.EnhanceStone,
            Name = "강화석", Grade = ItemGrade.Rare, Count = count, Price = 300,
        };

        public static ItemInstance CreateSkillBook(string skillId, int count = 1)
        {
            var def = SkillDb.Get(skillId);
            if (def == null) throw new ArgumentException("unknown skill " + skillId);
            return new ItemInstance
            {
                Uid = ItemInstance.NewUid(), TemplateId = "book_" + skillId, Kind = ItemKind.SkillBook,
                Name = "스킬서: " + def.Name, Grade = (ItemGrade)Math.Min((int)ItemGrade.Epic, (int)def.Tier + 1),
                SkillId = skillId, Count = count, Price = GameBalance.SkillBookPrice[(int)def.Tier],
                JobRestriction = def.JobRestriction,
            };
        }

        /// <summary>
        /// 테스트·재생성용 템플릿 아이템. TemplateId 만으로 소모품·재료·강화석·스킬서를 다시 만든다.
        /// </summary>
        public static ItemInstance CreateStackable(string templateId, int count)
        {
            if (templateId == EnhanceStoneId) return CreateEnhanceStone(count);
            if (templateId.StartsWith("book_")) return CreateSkillBook(templateId.Substring(5), count);
            if (Consumable(templateId) != null) return CreateConsumable(templateId, count);
            return CreateMaterial(templateId, count);
        }
    }
}
