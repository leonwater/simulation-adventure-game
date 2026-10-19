using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>보스 특성의 전투 처리 (BossKit). 방어막·보호막·가시 비늘은 맞을 때, 나머지는 보스의 차례에 처리한다.</summary>
    public partial class Battle
    {
        private const int MaxEnemySlots = 4;

        /// <summary>방어막이 남아 있으면 이번 타격을 막는다.</summary>
        private bool BlockedByBarrier(Combatant target)
        {
            var k = target.Kit;
            if (k == null || k.Barrier <= 0) return false;
            k.Barrier--;
            Event(BattleEventKind.Text, IndexOf(target), IndexOf(target), text: "방어막");
            return true;
        }

        /// <summary>보호막이 먼저 피해를 받는다. HP로 넘어가는 피해를 돌려준다.</summary>
        private static int AbsorbShield(Combatant target, int dmg)
        {
            var k = target.Kit;
            if (k == null || k.Shield <= 0) return dmg;
            int absorbed = Math.Min(k.Shield, dmg);
            k.Shield -= absorbed;
            return dmg - absorbed;
        }

        /// <summary>적이 피해를 받은 뒤: 가시 비늘 반사, 광폭화.</summary>
        private void AfterEnemyHit(Combatant e, int dmg, bool direct)
        {
            var k = e.Kit;
            if (k == null) return;
            if (direct && k.Thorns > 0 && dmg > 0 && Player.Alive)
            {
                int back = Math.Max(1, (int)Math.Round(dmg * k.Thorns));
                back = Math.Min(back, Player.Hp - 1); // 반사로는 쓰러지지 않는다
                if (back > 0)
                {
                    Player.Hp -= back;
                    Add("가시 비늘에 찔려 " + back + " 피해", LogTone.Bad);
                    Event(BattleEventKind.Damage, IndexOf(e), -1, back, DamageKind.Normal, Player.Hp);
                }
            }
            if (k.Has(BossTrait.Enrage) && !k.Enraged && e.Alive && e.HpRatio <= 0.5)
            {
                k.Enraged = true;
                e.Attack = Math.Max(1, (int)Math.Round(e.Attack * (1 + k.EnrageAttack)));
                Add(e.Name + "의 광폭화! 공격력 +" + Math.Round(k.EnrageAttack * 100) + "%", LogTone.Bad);
                Event(BattleEventKind.Text, IndexOf(e), -1, text: "광폭화!");
            }
        }

        /// <summary>보스의 특별한 행동. 차례를 썼으면 true (일반 공격을 하지 않는다).</summary>
        private bool BossTurn(Combatant e)
        {
            var k = e.Kit;
            int ei = IndexOf(e);
            if (k.Exhausted > 0)
            {
                k.Exhausted--;
                Add(Names.Josa(e.Name, "은/는") + " 탈진해 숨을 고른다.");
                Event(BattleEventKind.Text, ei, -1, text: "탈진");
                return true;
            }
            if (k.Chanting)
            {
                k.Chanting = false;
                k.RitualUses--;
                Add(e.Name + "의 재생 의식!", LogTone.Bad);
                Event(BattleEventKind.Text, ei, -1, text: "재생 의식");
                Heal(e, (int)Math.Round(e.MaxHp * k.RitualHeal));
                return true;
            }
            if (k.RitualUses > 0 && e.HpRatio <= k.RitualAt && !k.Charging)
            {
                k.Chanting = true;
                Add(Names.Josa(e.Name, "이/가") + " 치유 주문을 외우기 시작한다! 다음 턴 HP " + Math.Round(k.RitualHeal * 100) + "% 회복", LogTone.Bad);
                Event(BattleEventKind.Text, ei, -1, text: "주문 영창");
                return true;
            }
            if (k.Has(BossTrait.Smash))
            {
                if (k.Charging)
                {
                    k.Charging = false;
                    k.SmashTimer = 0;
                    k.Exhausted = k.ExhaustTurns;
                    Strike(e, "혼신의 일격", k.SmashMult, 1);
                    return true;
                }
                k.SmashTimer++;
                if (k.SmashTimer >= k.SmashEvery - 1)
                {
                    k.Charging = true;
                    Add(Names.Josa(e.Name, "이/가") + " 기를 모은다! 다음 턴 혼신의 일격 (피해 ×" + k.SmashMult.ToString("0.0#") + ")", LogTone.Bad);
                    Event(BattleEventKind.Text, ei, -1, text: "기를 모은다");
                    return true;
                }
            }
            if (k.Has(BossTrait.Summon))
            {
                k.SummonTimer++;
                if (k.SummonTimer >= k.SummonEvery && CanSummon(k))
                {
                    k.SummonTimer = 0;
                    Summon(e);
                    return true;
                }
            }
            if (k.Has(BossTrait.Flurry) && _rng.Chance(k.FlurryChance))
            {
                Strike(e, "연속 공격", k.FlurryMult, k.FlurryHits);
                return true;
            }
            return false;
        }

        private bool CanSummon(BossKit k) =>
            k.Minions.FindAll(m => m.Alive).Count < k.SummonMax && FreeSlot(-1) >= 0;

        /// <summary>보스의 강타·연속 공격: 타격마다 명중 판정, 흡혈 적용.</summary>
        private void Strike(Combatant e, string name, double mult, int hits)
        {
            int ei = IndexOf(e);
            Add(e.Name + "의 " + name + "!", LogTone.Bad);
            Event(BattleEventKind.Act, ei, -1, text: name);
            int landed = 0, total = 0;
            for (int h = 0; h < hits && Player.Alive; h++)
            {
                if (!_rng.Chance(EnemyHitChance(e)))
                {
                    Event(BattleEventKind.Miss, ei, -1, hpAfter: Player.Hp);
                    continue;
                }
                int dmg = Damage(e, Player, mult, false);
                Player.Hp = Math.Max(0, Player.Hp - dmg);
                total += dmg;
                landed++;
                Event(BattleEventKind.Damage, ei, -1, dmg, DamageKind.Normal, Player.Hp);
            }
            if (landed == 0) Add("모두 피했다!");
            else Add(total + " 피해" + (hits > 1 ? " (" + landed + "/" + hits + "회 명중)" : ""), LogTone.Bad);
            if (!Player.Alive) KilledBy = e.Name;
            else DrainLife(e, total);
        }

        /// <summary>흡혈: 준 피해의 일부만큼 회복.</summary>
        private void DrainLife(Combatant e, int dealt)
        {
            var k = e.Kit;
            if (k == null || k.Lifesteal <= 0 || dealt <= 0 || !e.Alive) return;
            Heal(e, Math.Max(1, (int)Math.Round(dealt * k.Lifesteal)));
        }

        private void Summon(Combatant boss)
        {
            var k = boss.Kit;
            int slot = FreeSlot(-1);
            var m = BossTraits.CreateMinion(boss, Floor, Difficulty, k.Minions.Count);
            k.Minions.Add(m);
            Place(m, slot);
            Add(Names.Josa(boss.Name, "이/가") + " " + Names.Josa(m.Name, "을/를") + " 불렀다!", LogTone.Bad);
            Event(BattleEventKind.Text, IndexOf(boss), -1, text: "부하 소환");
            Event(BattleEventKind.Spawn, IndexOf(boss), slot, hpAfter: m.Hp, text: m.Name);
        }

        /// <summary>
        /// 새 적을 놓을 자리: 원하는 칸이 비었으면 그 칸, 아니면 쓰러진 적의 칸, 그것도 없으면 4칸까지 뒤에 붙인다. 없으면 -1.
        /// </summary>
        private int FreeSlot(int prefer)
        {
            if (prefer >= 0 && prefer < Enemies.Count && !Enemies[prefer].Alive) return prefer;
            for (int i = 0; i < Enemies.Count; i++)
                if (!Enemies[i].Alive) return i;
            return Enemies.Count < MaxEnemySlots ? Enemies.Count : -1;
        }

        private void Place(Combatant c, int slot)
        {
            if (slot < Enemies.Count) Enemies[slot] = c;
            else Enemies.Add(c);
        }

        /// <summary>쓰러지기 직전: 부활하면 true (쓰러지지 않는다).</summary>
        private bool TryRevive(Combatant e)
        {
            var k = e.Kit;
            if (k == null || k.Revives <= 0) return false;
            k.Revives--;
            k.Chanting = k.Charging = false;
            e.Statuses.Clear();
            int hp = Math.Max(1, (int)Math.Round(e.MaxHp * k.ReviveHp));
            e.Hp = hp;
            Add(Names.Josa(e.Name, "이/가") + " 다시 일어섰다!", LogTone.Bad);
            Event(BattleEventKind.Text, IndexOf(e), -1, text: "부활!");
            Event(BattleEventKind.Heal, IndexOf(e), IndexOf(e), hp, DamageKind.Heal, hp);
            return true;
        }

        /// <summary>보스가 쓰러진 뒤: 졸개는 흩어지고, 분열하는 보스는 작은 개체로 나뉜다 (2페이즈).</summary>
        private void AfterBossDown(Combatant boss, int bossSlot)
        {
            var k = boss.Kit;
            bool fled = false;
            foreach (var m in k.Minions)
            {
                if (!m.Alive) continue;
                m.Hp = 0;
                fled = true;
                Event(BattleEventKind.Defeat, -1, IndexOf(m));
            }
            if (fled) Add("우두머리를 잃은 졸개들이 흩어졌다.", LogTone.Good);

            if (k.SplitCount <= 0) return;
            var children = new List<Combatant>();
            for (int i = 0; i < k.SplitCount; i++)
            {
                int slot = FreeSlot(i == 0 ? bossSlot : -1);
                if (slot < 0) break;
                var child = BossTraits.SplitChild(boss, i);
                Place(child, slot);
                children.Add(child);
            }
            if (children.Count == 0) return;
            Add(Names.Josa(boss.Name, "이/가") + " " + children.Count + "마리로 나뉘었다! (2페이즈)", LogTone.Bad);
            Event(BattleEventKind.Text, bossSlot, -1, text: "분열!");
            foreach (var c in children) Event(BattleEventKind.Spawn, -1, IndexOf(c), hpAfter: c.Hp, text: c.Name);
        }

        /// <summary>다음 턴 행동 예고: 보스 위에 짧게 표시하고, 자세한 내용은 기록에 남긴다.</summary>
        private void UpdateIntents()
        {
            foreach (var e in Enemies)
            {
                var k = e.Kit;
                if (k == null) continue;
                string before = k.Intent;
                if (!e.Alive) k.Intent = "";
                else if (k.Exhausted > 0) k.Intent = "탈진 " + k.Exhausted + "턴";
                else if (k.Chanting) k.Intent = "회복 주문 영창";
                else if (k.Charging) k.Intent = "강타 준비 ×" + k.SmashMult.ToString("0.0#");
                else if (k.Has(BossTrait.Summon) && k.SummonTimer + 1 >= k.SummonEvery && CanSummon(k)) k.Intent = "부하 소환 예고";
                else k.Intent = "";
                if (k.Intent == "부하 소환 예고" && before != k.Intent) Add(Names.Josa(e.Name, "이/가") + " 부하를 부르려 한다. 다음 턴 졸개가 나타난다.", LogTone.Bad);
            }
        }

        /// <summary>대상의 방어막·보호막 (선택지 예상 피해 옆에 붙인다).</summary>
        private static string GuardNote(Combatant target)
        {
            var k = target?.Kit;
            if (k == null) return "";
            if (k.Barrier > 0) return " · 방어막 " + k.Barrier + "회 (막힘)";
            if (k.Shield > 0) return " · 보호막 " + k.Shield;
            return "";
        }
    }
}
