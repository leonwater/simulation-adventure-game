using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    public enum BattleOutcome
    {
        Ongoing,
        Victory,
        Defeat,
        Fled
    }

    public enum ActionKind
    {
        Wait,
        Attack,
        Skill,
        Item,
        Flee
    }

    public enum LogTone
    {
        Normal,
        Good,   // 치명타·처치 등 (금색)
        Bad,    // 받은 피해·디버프 (붉은색)
        System  // 차례 안내
    }

    public struct LogLine
    {
        public string Text;
        public LogTone Tone;

        public LogLine(string text, LogTone tone = LogTone.Normal)
        {
            Text = text;
            Tone = tone;
        }
    }

    /// <summary>피해 숫자 색 구분 (수정 사항 #21).</summary>
    public enum DamageKind
    {
        Normal,
        Crit,
        Poison,
        Bleed,
        Burn,
        Heal
    }

    public enum BattleEventKind
    {
        /// <summary>행동 시작 (도형이 상대 쪽으로 돌진).</summary>
        Act,
        Damage,
        Miss,
        Heal,
        Status,
        Defeat,
        Text
    }

    /// <summary>화면 연출용 전투 사건. Actor/Target: -1 = 플레이어, 0 이상 = 적 번호.</summary>
    public struct BattleEvent
    {
        public BattleEventKind Kind;
        public int Actor;
        public int Target;
        public int Amount;
        public DamageKind Damage;
        public int HpAfter;
        public string Text;
    }

    /// <summary>전투 화면 선택지 하나. 모든 선택은 1턴을 쓴다.</summary>
    public class BattleChoice
    {
        public ActionKind Kind;
        public string Label = "";
        /// <summary>대상 적 번호 (-1 = 대상 없음).</summary>
        public int Target = -1;
        public string SkillId;
        public string ItemUid;
        /// <summary>성공 확률 (0~1).</summary>
        public double Chance = 1.0;
        public bool Enabled = true;
        /// <summary>쓸 수 없을 때 오른쪽에 보여 줄 문구 (예: "2턴 후 사용 가능").</summary>
        public string Note = "";
        /// <summary>길게 눌렀을 때 보여 줄 설명과 성공률 계산 내역.</summary>
        public string Detail = "";
    }

    /// <summary>
    /// 선택지 기반 턴제 전투. 플레이어가 하나 고르면 1턴: 플레이어 행동 → 살아 있는 적들의 행동.
    /// 치명타는 스킬에서만 발생하며 피해 ×1.8. 여러 번 때리는 스킬은 타격마다 따로 판정한다.
    /// 상태 이상 지속 턴은 주인의 턴이 끝날 때 줄어든다 (이번 턴에 걸린 효과는 다음 턴부터).
    /// </summary>
    public class Battle
    {
        public readonly Character Character;
        public readonly Combatant Player;
        public readonly List<Combatant> Enemies;
        public readonly int Floor;
        public readonly bool IsBoss;
        public int Turn = 1;
        public BattleOutcome Outcome = BattleOutcome.Ongoing;
        public string KilledBy = "";
        public readonly List<LogLine> Log = new List<LogLine>();
        /// <summary>마지막 행동(또는 기습)에서 일어난 일. 화면 연출용.</summary>
        public readonly List<BattleEvent> LastEvents = new List<BattleEvent>();
        /// <summary>처치한 적 (보상·퀘스트 처리용).</summary>
        public readonly List<Combatant> Defeated = new List<Combatant>();
        /// <summary>연막: 다음에 쓰는 공격 스킬이 확정 치명타.</summary>
        public bool NextSkillCrit;

        private readonly Dictionary<string, int> _cooldowns = new Dictionary<string, int>();
        private readonly Rng _rng;

        /// <param name="ambush">true면 적이 먼저 행동한다 (미믹 기습).</param>
        public Battle(Character c, int floor, List<Combatant> enemies, bool isBoss, Rng rng, bool ambush = false)
        {
            Character = c;
            Floor = floor;
            Enemies = enemies;
            IsBoss = isBoss;
            _rng = rng;
            Player = new Combatant
            {
                Name = c.Name,
                IsPlayer = true,
                MaxHp = CharacterStats.MaxHp(c),
                Hp = Math.Max(1, Math.Min(c.CurrentHp, CharacterStats.MaxHp(c))),
                Attack = CharacterStats.Attack(c),
                Defense = CharacterStats.Defense(c),
                Evasion = CharacterStats.Evasion(c),
                DamageReduction = CharacterStats.DamageReduction(c),
                Resist = CharacterStats.Resist(c),
                CritDamage = GameBalance.CritMultiplier,
            };
            var names = new List<string>();
            foreach (var e in enemies) names.Add(e.Name);
            Add(Names.Josa((isBoss ? "보스 " : "") + string.Join(", ", names), "이/가") + " 나타났다!", LogTone.Bad);
            if (ambush)
            {
                Add("기습이다! 적이 먼저 움직인다.", LogTone.Bad);
                Event(BattleEventKind.Text, -1, -1, text: "기습!");
                EnemyPhase();
                if (IsOver) return;
            }
            Add("▶ 당신의 차례입니다.", LogTone.System);
        }

        public bool IsOver => Outcome != BattleOutcome.Ongoing;

        public int Cooldown(string skillId) => _cooldowns.TryGetValue(skillId, out int n) ? n : 0;

        public bool CanFlee => !IsBoss;

        public int IndexOf(Combatant c) => c.IsPlayer ? -1 : Enemies.IndexOf(c);

        private void Add(string text, LogTone tone = LogTone.Normal) => Log.Add(new LogLine(text, tone));

        private void Event(BattleEventKind kind, int actor, int target, int amount = 0, DamageKind damage = DamageKind.Normal, int hpAfter = 0, string text = null)
        {
            LastEvents.Add(new BattleEvent { Kind = kind, Actor = actor, Target = target, Amount = amount, Damage = damage, HpAfter = hpAfter, Text = text });
        }

        // ── 확률 ───────────────────────────────────────────────

        private double StatusBonus(bool flee)
        {
            var s = Player.Statuses;
            double bonus = s.Value(StatusType.Focus) / 100.0 - s.Value(StatusType.Blind) / 100.0;
            if (!flee) bonus -= s.Value(StatusType.Fear) / 100.0;
            return bonus;
        }

        /// <summary>공격 성공률 = 83% + (주 공격 능력치 − 적 요구치) × 1% + 정밀 + 버프 + 스킬 보정, 60~95%.</summary>
        public double HitChance(Combatant target, double skillBonus = 0)
        {
            double stat = CharacterStats.Total(Character, Character.JobData.AttackStat);
            return GameBalance.HitChance(stat, target.Requirement, CharacterStats.PrecisionBonus(Character) + StatusBonus(false) + skillBonus);
        }

        /// <summary>도주 = 60% + 회피 + 집중 − 실명 (공포는 영향 없음), 최대 90%. 보스전은 불가.</summary>
        public double FleeChance()
        {
            if (!CanFlee) return GameBalance.BossFleeChance;
            double p = GameBalance.BaseFlee + Player.Evasion + Player.Statuses.Value(StatusType.Swift) / 100.0 + StatusBonus(true);
            return GameBalance.Clamp(p, GameBalance.MinSuccess, GameBalance.MaxFlee);
        }

        /// <summary>적이 플레이어를 맞힐 확률 = 90% − 회피 − 날렵함 − 적의 실명.</summary>
        public double EnemyHitChance(Combatant enemy)
        {
            double p = GameBalance.EnemyBaseHit - Player.Evasion - Player.Statuses.Value(StatusType.Swift) / 100.0
                       - enemy.Statuses.Value(StatusType.Blind) / 100.0;
            return GameBalance.Clamp(p, GameBalance.MinSuccess, GameBalance.MaxSuccess);
        }

        private static string Pct(double v) => (v >= 0 ? "+" : "−") + Math.Round(Math.Abs(v) * 100, 1) + "%";

        /// <summary>성공률 계산 내역 (길게 눌러 보기).</summary>
        public string HitBreakdown(Combatant target, double skillBonus)
        {
            double stat = CharacterStats.Total(Character, Character.JobData.AttackStat);
            var parts = new List<string> { "기본 83%" };
            parts.Add(Names.Of(Character.JobData.AttackStat) + " " + stat + " vs 요구치 " + Math.Round(target.Requirement, 1) + ": " + Pct((stat - target.Requirement) * GameBalance.HitPerStatPoint));
            double prec = CharacterStats.PrecisionBonus(Character);
            if (prec > 0) parts.Add("정밀 " + Pct(prec));
            var s = Player.Statuses;
            if (s.Has(StatusType.Focus)) parts.Add("집중 " + Pct(s.Value(StatusType.Focus) / 100.0));
            if (s.Has(StatusType.Blind)) parts.Add("실명 " + Pct(-s.Value(StatusType.Blind) / 100.0));
            if (s.Has(StatusType.Fear)) parts.Add("공포 " + Pct(-s.Value(StatusType.Fear) / 100.0));
            if (Math.Abs(skillBonus) > 1e-9) parts.Add("스킬 보정 " + Pct(skillBonus));
            return string.Join("\n", parts) + "\n= " + Math.Round(HitChance(target, skillBonus) * 100) + "% (60~95% 범위)";
        }

        private string FleeBreakdown()
        {
            if (!CanFlee) return "보스에게서는 도망칠 수 없다.";
            var parts = new List<string> { "기본 60%", "회피 " + Pct(Player.Evasion) };
            var s = Player.Statuses;
            if (s.Has(StatusType.Swift)) parts.Add("날렵함 " + Pct(s.Value(StatusType.Swift) / 100.0));
            if (s.Has(StatusType.Focus)) parts.Add("집중 " + Pct(s.Value(StatusType.Focus) / 100.0));
            if (s.Has(StatusType.Blind)) parts.Add("실명 " + Pct(-s.Value(StatusType.Blind) / 100.0));
            return string.Join("\n", parts) + "\n= " + Math.Round(FleeChance() * 100) + "% (최대 90%)\n실패하면 적이 행동한다.";
        }

        // ── 선택지 ─────────────────────────────────────────────

        public List<BattleChoice> GetChoices()
        {
            var list = new List<BattleChoice>();
            if (IsOver) return list;
            if (Player.Statuses.Has(StatusType.Stun))
            {
                list.Add(new BattleChoice { Kind = ActionKind.Wait, Label = "기절해 움직일 수 없다", Note = "턴 넘기기", Detail = "기절: 이번 턴은 행동할 수 없다." });
                return list;
            }
            var alive = AliveEnemies();
            double basic = Character.JobData.BasicAttackMultiplier;
            foreach (var e in alive)
            {
                list.Add(new BattleChoice
                {
                    Kind = ActionKind.Attack, Label = "공격 · " + e.Name, Target = Enemies.IndexOf(e), Chance = HitChance(e),
                    Detail = "기본 공격: 피해 " + Math.Round(basic * 100) + "%, 치명타 없음\n\n" + HitBreakdown(e, 0),
                });
            }

            bool silenced = Player.Statuses.Has(StatusType.Silence);
            foreach (string id in Character.Skills.Equipped)
            {
                var def = SkillDb.Get(id);
                if (def == null) continue;
                int cd = Cooldown(id);
                string note = silenced ? "침묵 상태" : cd > 0 ? cd + "턴 후 사용 가능" : "";
                bool enabled = note.Length == 0;
                string head = def.Name + " (" + Names.Of(def.Tier) + ")\n" + def.Description + (NextSkillCrit && def.IsAttack ? "\n연막: 이번 스킬은 확정 치명타" : "");
                if (def.NeedsTarget && enabled)
                {
                    foreach (var e in alive)
                        list.Add(new BattleChoice
                        {
                            Kind = ActionKind.Skill, SkillId = id, Label = def.Name + " · " + e.Name, Target = Enemies.IndexOf(e),
                            Chance = HitChance(e, def.SuccessBonus), Detail = head + "\n\n" + HitBreakdown(e, def.SuccessBonus),
                        });
                }
                else
                {
                    double chance = 1.0;
                    string detail = head;
                    if (def.Target == SkillTarget.AllEnemies && alive.Count > 0)
                    {
                        chance = 0;
                        foreach (var e in alive) chance += HitChance(e, def.SuccessBonus);
                        chance /= alive.Count;
                        detail += "\n\n적마다 따로 판정 (평균 " + Math.Round(chance * 100) + "%)\n" + HitBreakdown(alive[0], def.SuccessBonus);
                    }
                    else if (def.Target == SkillTarget.Self) detail += "\n\n자신에게 거는 스킬: 성공률 100%";
                    list.Add(new BattleChoice { Kind = ActionKind.Skill, SkillId = id, Label = def.Name, Chance = chance, Enabled = enabled, Note = note, Detail = detail });
                }
            }

            bool hasItems = GetItemChoices().Count > 0;
            list.Add(new BattleChoice { Kind = ActionKind.Item, Label = "아이템 사용", Enabled = hasItems, Note = hasItems ? "›" : "없음", Detail = "소모품을 쓴다. 1턴을 사용한다." });
            list.Add(new BattleChoice
            {
                Kind = ActionKind.Flee, Label = "도망친다", Chance = FleeChance(), Enabled = CanFlee,
                Note = CanFlee ? "" : "보스에게서는 도망칠 수 없다", Detail = FleeBreakdown(),
            });
            return list;
        }

        /// <summary>전투 중 쓸 수 있는 소모품.</summary>
        public List<BattleChoice> GetItemChoices()
        {
            var list = new List<BattleChoice>();
            foreach (var item in Character.Inventory.Items)
            {
                if (item.Kind != ItemKind.Consumable) continue;
                var def = ItemDb.Consumable(item.TemplateId);
                if (def == null) continue;
                bool useful = def.HealRatio > 0 ? Player.Hp < Player.MaxHp : def.Cures != null && Player.Statuses.Has(def.Cures.Value);
                list.Add(new BattleChoice
                {
                    Kind = ActionKind.Item, ItemUid = item.Uid, Label = item.Name + " ×" + item.Count,
                    Enabled = useful, Note = useful ? def.Description : (def.HealRatio > 0 ? "HP 가득" : "해당 없음"), Detail = def.Description,
                });
            }
            return list;
        }

        public List<Combatant> AliveEnemies() => Enemies.FindAll(e => e.Alive);

        // ── 턴 진행 ────────────────────────────────────────────

        /// <summary>선택지를 실행하고 적의 차례까지 진행한다. 연출용 사건은 LastEvents에 쌓인다.</summary>
        public void Execute(BattleChoice choice)
        {
            if (IsOver) throw new InvalidOperationException("전투가 끝났습니다");
            if (choice == null || !choice.Enabled) throw new InvalidOperationException("선택할 수 없습니다");
            LastEvents.Clear();

            StartOfTurn(Player);
            if (!CheckEnd())
            {
                if (Player.Statuses.Has(StatusType.Stun))
                {
                    Add(Names.Josa(Player.Name, "은/는") + " 기절해 움직일 수 없다.", LogTone.Bad);
                    Event(BattleEventKind.Text, -1, -1, text: "기절");
                }
                else PlayerAct(choice);
            }
            EndOfTurn(Player);
            TickCooldowns(choice);
            if (CheckEnd()) return;

            EnemyPhase();
            if (IsOver) return;
            Turn++;
            Add("▶ 당신의 차례입니다.", LogTone.System);
        }

        private void EnemyPhase()
        {
            foreach (var e in Enemies)
            {
                if (!e.Alive) continue;
                StartOfTurn(e);
                if (e.Alive)
                {
                    if (e.Statuses.Has(StatusType.Stun))
                    {
                        Add(Names.Josa(e.Name, "은/는") + " 기절해 있다.");
                        Event(BattleEventKind.Text, IndexOf(e), -1, text: "기절");
                    }
                    else EnemyAct(e);
                }
                EndOfTurn(e);
                if (CheckEnd()) return;
            }
        }

        private void TickCooldowns(BattleChoice used)
        {
            var keys = new List<string>(_cooldowns.Keys);
            foreach (var k in keys)
            {
                if (used.Kind == ActionKind.Skill && used.SkillId == k && _cooldowns[k] == SkillDb.Get(k).Cooldown) continue;
                _cooldowns[k] = Math.Max(0, _cooldowns[k] - 1);
            }
        }

        private void PlayerAct(BattleChoice choice)
        {
            Bleed(Player);
            if (!Player.Alive) return;
            switch (choice.Kind)
            {
                case ActionKind.Attack:
                    Event(BattleEventKind.Act, -1, choice.Target);
                    PlayerHits(Enemies[choice.Target], Character.JobData.BasicAttackMultiplier, 1, 0, null, false);
                    break;
                case ActionKind.Skill:
                    UseSkill(choice);
                    break;
                case ActionKind.Item:
                    UseItem(choice.ItemUid);
                    break;
                case ActionKind.Flee:
                    if (_rng.Chance(FleeChance()))
                    {
                        Outcome = BattleOutcome.Fled;
                        Add("무사히 도망쳤다.", LogTone.System);
                        Event(BattleEventKind.Text, -1, -1, text: "도주 성공");
                    }
                    else
                    {
                        Add("도망치지 못했다!", LogTone.Bad);
                        Event(BattleEventKind.Text, -1, -1, text: "도주 실패");
                    }
                    break;
            }
        }

        /// <summary>스킬 대상 목록: 고른 적부터, 나머지 살아 있는 적을 순서대로.</summary>
        private List<Combatant> SkillTargets(SkillDef def, int primary)
        {
            var alive = AliveEnemies();
            if (def.Target == SkillTarget.AllEnemies) return alive;
            var list = new List<Combatant>();
            if (primary >= 0 && primary < Enemies.Count && Enemies[primary].Alive) list.Add(Enemies[primary]);
            int want = def.Target == SkillTarget.MultiEnemy ? def.TargetCount : def.Target == SkillTarget.ChainEnemies ? def.ChainMults.Length : 1;
            foreach (var e in alive)
            {
                if (list.Count >= want) break;
                if (!list.Contains(e)) list.Add(e);
            }
            return list;
        }

        private void UseSkill(BattleChoice choice)
        {
            var def = SkillDb.Get(choice.SkillId);
            var state = Character.Skills.Get(choice.SkillId);
            double power = SkillSystem.PowerMultiplier(state?.Level ?? 0);
            _cooldowns[def.Id] = def.Cooldown;
            Add(def.Name + "!");

            if (def.Target == SkillTarget.Self)
            {
                Event(BattleEventKind.Text, -1, -1, text: def.Name);
                if (def.HealRatio > 0) Heal(Player, (int)Math.Round(Player.MaxHp * def.HealRatio * power));
                foreach (var s in def.Statuses) ApplyStatus(Player, Player, s);
                if (def.GrantsNextCrit)
                {
                    NextSkillCrit = true;
                    Add("다음 스킬은 확정 치명타!", LogTone.Good);
                }
                return;
            }

            bool forcedCrit = NextSkillCrit;
            NextSkillCrit = false;
            var targets = SkillTargets(def, choice.Target);
            Event(BattleEventKind.Act, -1, targets.Count > 0 ? IndexOf(targets[0]) : -1, text: def.Name);
            double baseMult = def.DamageMult * power * (1.0 + CharacterStats.SkillDamageBonus(Character));
            for (int i = 0; i < targets.Count; i++)
            {
                double mult = def.Target == SkillTarget.ChainEnemies
                    ? def.ChainMults[i] * power * (1.0 + CharacterStats.SkillDamageBonus(Character))
                    : baseMult;
                PlayerHits(targets[i], mult, def.Hits, def.SuccessBonus, def, forcedCrit);
            }
        }

        /// <summary>플레이어의 타격. 타격마다 명중을 따로 판정하고, 치명타는 스킬에서만 난다.</summary>
        private void PlayerHits(Combatant target, double mult, int hits, double successBonus, SkillDef skill, bool forcedCrit)
        {
            if (!target.Alive) return;
            int ti = IndexOf(target);
            int landed = 0, total = 0;
            bool anyCrit = false;
            for (int h = 0; h < hits && target.Alive; h++)
            {
                if (!_rng.Chance(HitChance(target, successBonus)))
                {
                    Event(BattleEventKind.Miss, -1, ti, hpAfter: target.Hp);
                    continue;
                }
                bool crit = skill != null && (forcedCrit || skill.GuaranteedCrit || (skill.FirstTurnCrit && Turn == 1) || _rng.Chance(skill.CritChance));
                double m = mult;
                if (skill != null && skill.ExecuteThreshold > 0 && target.HpRatio <= skill.ExecuteThreshold) m *= skill.ExecuteMult;
                int dmg = Damage(Player, target, m, crit);
                target.Hp = Math.Max(0, target.Hp - dmg);
                total += dmg;
                landed++;
                anyCrit |= crit;
                Event(BattleEventKind.Damage, -1, ti, dmg, crit ? DamageKind.Crit : DamageKind.Normal, target.Hp);
            }
            string what = skill == null ? "공격" : skill.Name;
            if (landed == 0) Add(target.Name + "에게 " + what + " — 빗나갔다.");
            else
            {
                string count = hits > 1 ? " (" + landed + "/" + hits + "회 명중)" : "";
                Add(target.Name + "에게 " + (anyCrit ? "치명타 " : "") + total + " 피해" + count, anyCrit ? LogTone.Good : LogTone.Normal);
            }
            if (skill != null && landed > 0 && target.Alive)
                foreach (var s in skill.Statuses) ApplyStatus(Player, target, s);
            if (!target.Alive) OnEnemyDown(target);
        }

        private void UseItem(string uid)
        {
            var item = Character.Inventory.Find(uid);
            var def = item == null ? null : ItemDb.Consumable(item.TemplateId);
            if (def == null) return;
            Character.Inventory.Take(uid, 1);
            Add(Names.Josa(def.Name, "을/를") + " 사용했다.");
            Event(BattleEventKind.Text, -1, -1, text: def.Name);
            if (def.HealRatio > 0) Heal(Player, (int)Math.Round(Player.MaxHp * def.HealRatio));
            if (def.Cures != null && Player.Statuses.Remove(def.Cures.Value)) Add(Names.Of(def.Cures.Value) + " 상태가 풀렸다.", LogTone.Good);
        }

        private void EnemyAct(Combatant e)
        {
            int ei = IndexOf(e);
            Bleed(e);
            if (!e.Alive)
            {
                OnEnemyDown(e);
                return;
            }
            EnemySkill skill = null;
            foreach (var s in e.Skills)
            {
                if (_rng.Chance(s.UseChance))
                {
                    skill = s;
                    break;
                }
            }
            if (skill != null && skill.DamageMult <= 0)
            {
                Add(e.Name + "의 " + skill.Name + "!");
                Event(BattleEventKind.Text, ei, -1, text: skill.Name);
                if (skill.Status != null) ApplyStatus(e, skill.Status.OnSelf ? e : Player, skill.Status);
                return;
            }
            string what = skill == null ? "공격" : skill.Name;
            Event(BattleEventKind.Act, ei, -1, text: skill?.Name);
            if (!_rng.Chance(EnemyHitChance(e)))
            {
                Add(e.Name + "의 " + what + ". 피했다!");
                Event(BattleEventKind.Miss, ei, -1, hpAfter: Player.Hp);
                return;
            }
            int dmg = Damage(e, Player, skill?.DamageMult ?? 1.0, false);
            Player.Hp = Math.Max(0, Player.Hp - dmg);
            Add(e.Name + "의 " + what + ". " + dmg + " 피해", LogTone.Bad);
            Event(BattleEventKind.Damage, ei, -1, dmg, DamageKind.Normal, Player.Hp);
            if (skill?.Status != null && Player.Alive) ApplyStatus(e, skill.Status.OnSelf ? e : Player, skill.Status);
            if (!Player.Alive) KilledBy = e.Name;
        }

        /// <summary>피해 = 공격력 × 배율 × (강화·약화) × 100/(100+방어력) × (1 − 감소율) × (철벽·취약) × 치명타(×1.8)</summary>
        public static int Damage(Combatant attacker, Combatant target, double mult, bool crit)
        {
            var a = attacker.Statuses;
            var t = target.Statuses;
            double atk = attacker.Attack * mult * (1.0 + a.Value(StatusType.Empower) / 100.0 - a.Value(StatusType.Weaken) / 100.0);
            double dmg = atk * 100.0 / (100.0 + Math.Max(0, target.Defense));
            dmg *= 1.0 - target.DamageReduction;
            dmg *= 1.0 - t.Value(StatusType.Fortify) / 100.0 + t.Value(StatusType.Vulnerable) / 100.0;
            if (crit) dmg *= attacker.CritDamage;
            return Math.Max(1, (int)Math.Round(dmg));
        }

        private void ApplyStatus(Combatant source, Combatant target, StatusApply s)
        {
            if (!target.Alive) return;
            if (!_rng.Chance(s.Chance)) return;
            bool debuff = StatusContainer.IsDebuff(s.Type);
            if (debuff && target != source && _rng.Chance(target.Resist))
            {
                Add(Names.Josa(target.Name, "은/는") + " " + Names.Of(s.Type) + "에 저항했다.");
                Event(BattleEventKind.Text, IndexOf(target), -1, text: "저항");
                return;
            }
            int value = s.Value;
            if (s.Type == StatusType.Bleed || s.Type == StatusType.Burn)
                value = Math.Max(1, (int)Math.Round(source.Attack * s.Value / 100.0));
            target.Statuses.Apply(s.Type, value, s.Turns);
            string who = target.IsPlayer ? "" : target.Name + ": ";
            Add(who + Names.Of(s.Type) + " " + s.Turns + "턴", debuff == target.IsPlayer ? LogTone.Bad : LogTone.Good);
            Event(BattleEventKind.Status, IndexOf(source), IndexOf(target), text: Names.Of(s.Type));
        }

        private void StartOfTurn(Combatant c)
        {
            var s = c.Statuses;
            int poison = s.Value(StatusType.Poison);
            if (poison > 0) Hurt(c, (int)Math.Max(1, Math.Round(c.MaxHp * poison / 100.0)), "독", DamageKind.Poison);
            int burn = s.Value(StatusType.Burn);
            if (burn > 0 && c.Alive) Hurt(c, burn, "화상", DamageKind.Burn);
            int regen = s.Value(StatusType.Regen) + c.RegenPercent;
            if (regen > 0 && c.Alive && c.Hp < c.MaxHp) Heal(c, (int)Math.Round(c.MaxHp * regen / 100.0));
            if (!c.Alive && !c.IsPlayer) OnEnemyDown(c);
        }

        private void Bleed(Combatant c)
        {
            int bleed = c.Statuses.Value(StatusType.Bleed);
            if (bleed > 0) Hurt(c, bleed, "출혈", DamageKind.Bleed);
        }

        private void Hurt(Combatant c, int amount, string cause, DamageKind kind)
        {
            c.Hp = Math.Max(0, c.Hp - amount);
            Add((c.IsPlayer ? "" : c.Name + ": ") + Names.Josa(cause, "으로/로") + " " + amount + " 피해", c.IsPlayer ? LogTone.Bad : LogTone.Normal);
            Event(BattleEventKind.Damage, -2, IndexOf(c), amount, kind, c.Hp);
            if (c.IsPlayer && !c.Alive) KilledBy = cause;
        }

        private void Heal(Combatant c, int amount)
        {
            if (c.Statuses.Has(StatusType.Burn)) amount /= 2; // 화상: 받는 회복량 −50%
            int before = c.Hp;
            c.Hp = Math.Min(c.MaxHp, c.Hp + Math.Max(0, amount));
            if (c.Hp <= before) return;
            Add((c.IsPlayer ? "" : c.Name + ": ") + "HP " + (c.Hp - before) + " 회복", c.IsPlayer ? LogTone.Good : LogTone.Normal);
            Event(BattleEventKind.Heal, IndexOf(c), IndexOf(c), c.Hp - before, DamageKind.Heal, c.Hp);
        }

        private void EndOfTurn(Combatant c) => c.Statuses.Tick();

        private void OnEnemyDown(Combatant e)
        {
            if (Defeated.Contains(e)) return;
            Defeated.Add(e);
            Add(Names.Josa(e.Name, "을/를") + " 쓰러뜨렸다!", LogTone.Good);
            Event(BattleEventKind.Defeat, -1, IndexOf(e));
        }

        private bool CheckEnd()
        {
            if (Outcome != BattleOutcome.Ongoing) return true;
            if (!Player.Alive)
            {
                Outcome = BattleOutcome.Defeat;
                Add("쓰러졌다…", LogTone.Bad);
                Event(BattleEventKind.Defeat, -1, -1);
                return true;
            }
            if (AliveEnemies().Count == 0)
            {
                Outcome = BattleOutcome.Victory;
                Add("전투에서 승리했다!", LogTone.Good);
                return true;
            }
            return false;
        }

        /// <summary>전투 결과의 HP를 캐릭터에 반영한다 (전투가 끝나면 상태 이상은 사라진다).</summary>
        public void SyncHp()
        {
            Character.CurrentHp = Math.Max(Outcome == BattleOutcome.Defeat ? 0 : 1, Player.Hp);
        }

        /// <summary>승리 보상: 경험치·골드·드롭. 퀘스트 처치 기록도 여기서 한다.</summary>
        public LootReport CollectRewards(GuildState guild, DungeonRun run)
        {
            var report = new LootReport();
            if (Outcome != BattleOutcome.Victory) return report;
            double drop = CharacterStats.DropBonus(Character);
            foreach (var e in Defeated)
            {
                report.Exp += e.ExpReward;
                report.Gold += e.GoldReward;
                if (e.Species != null && guild != null) GuildSystem.OnEnemyKilled(guild, e.Species.Id, Floor);
                RollDrops(e, drop, report);
            }
            if (run != null) run.EnemiesDefeated += Defeated.Count;
            LootSystem.Apply(Character, run, report);
            return report;
        }

        private void RollDrops(Combatant e, double drop, LootReport report)
        {
            int role = e.Role;
            if (e.Species != null && !string.IsNullOrEmpty(e.Species.MaterialId) && _rng.Chance(Math.Min(1, GameBalance.MaterialDrop * drop)))
                report.Items.Add(ItemDb.CreateMaterial(e.Species.MaterialId, role == 2 ? 3 : 1));
            double equip = e.GuaranteedEquipment ? 1.0 : role == 2 ? GameBalance.EquipDropBoss : role == 1 ? GameBalance.EquipDropElite : GameBalance.EquipDropNormal;
            if (_rng.Chance(Math.Min(1, equip * drop))) report.Items.Add(LootSystem.RandomEquipment(Floor, Character, _rng, Math.Max(role, e.GuaranteedEquipment ? 1 : 0)));
            double book = role == 2 ? GameBalance.SkillBookDropBoss : role == 1 ? GameBalance.SkillBookDropElite : GameBalance.SkillBookDropNormal;
            if (_rng.Chance(book * drop)) report.Items.Add(LootSystem.HighSkillBook(Character, _rng));
            if (role == 2) report.Items.Add(ItemDb.CreateEnhanceStone(GameBalance.StoneDropBoss));
            else if (_rng.Chance((role == 1 ? GameBalance.StoneDropElite : GameBalance.StoneDropNormal) * drop))
                report.Items.Add(ItemDb.CreateEnhanceStone());
        }
    }
}
