using System;
using System.Collections.Generic;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>
    /// 전투 (수정 사항 #9·#21·#24·#25):
    /// 위 40% 전투 무대(왼쪽 내 원형, 오른쪽 적 최대 4 — 일반 사각형 · 엘리트 굵은 테두리 · 보스 육각형),
    /// 적을 눌러 대상 선택, 2~3줄 기록, 아래 선택지(성공 확률, 길게 누르면 계산 내역).
    /// 행동 결과는 Battle.LastEvents를 차례로 재생한다 (돌진·흔들림·번쩍임·떠오르는 피해 숫자).
    /// </summary>
    public class BattleScreen : ScreenBase
    {
        private const float StageW = Theme.ScreenWidth, StageH = 300, StepTime = 0.32f;

        private Battle _b;
        private int _target = -1;
        private bool _playing, _finished, _leaving, _started;
        private List<BattleEvent> _pending;
        private Dictionary<int, int> _hpBefore;

        private RectTransform _stage;
        private CanvasGroup _choicesGroup;
        private readonly Dictionary<int, UnitView> _units = new Dictionary<int, UnitView>();

        private class UnitView
        {
            public RectTransform Shape;
            public Image Fill;
            public RectTransform Bar;
            public Text HpText;
            public bool EnemyHp;
            public Vector2 Center;
            public float Size;
            public int MaxHp;
            public CanvasGroup Group;
        }

        private enum Shape
        {
            Circle,
            Square,
            Hexagon
        }

        public override bool OnBack()
        {
            if (!_playing && !_finished && !_leaving) Pause();
            return true;
        }

        public override void Build(RectTransform root)
        {
            if (_b == null) _b = S.Battle;
            if (_b == null)
            {
                App.GoToCurrent();
                return;
            }
            if (!_started)
            {
                _started = true;
                // 기습 등 전투 시작과 동시에 일어난 일
                if (_b.LastEvents.Count > 0)
                {
                    _pending = new List<BattleEvent>(_b.LastEvents);
                    _hpBefore = InferBefore(_pending);
                }
            }
            FixTarget();
            _units.Clear();

            var page = ScreenKit.Page(root);
            TopBar(page);
            _stage = UI.Rect(page, "stage");
            UI.Size(_stage, height: StageH);
            BuildStage();
            Log(page);

            var lower = UI.Column(page, 8, UI.Pad(16, 16, 8, 14), TextAnchor.UpperLeft, "lower");
            UI.Size(lower, flexH: 1);
            _choicesGroup = lower.gameObject.AddComponent<CanvasGroup>();
            if (_finished) Finished(lower);
            else if (!_b.IsOver || _pending != null) Choices(lower);

            if (_pending != null)
            {
                var events = _pending;
                _pending = null;
                StartPlayback(events);
            }
            else Tutorial.OnBattle();
        }

        private void FixTarget()
        {
            if (_target >= 0 && _target < _b.Enemies.Count && _b.Enemies[_target].Alive) return;
            _target = _b.Enemies.FindIndex(e => e.Alive);
        }

        // ── 머리줄: 속도 1×/2× · 순간이동(전투 중 사용 불가) · 일시정지 ──

        private void TopBar(Transform parent)
        {
            var head = UI.Card(parent, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(16, 10, 6, 6), false, 6, TextAnchor.MiddleLeft, "header");
            UI.Size(head, height: 58);
            var title = UI.Label(head, _b.Floor + "층 · " + (_b.IsBoss ? "보스전" : "전투") + " " + UI.Color(_b.Turn + "턴째", Theme.SubHex), 15, Theme.Text, true);
            UI.Size(title, flexW: 1);
            Text speedLabel = null;
            var speed = IconButton(head, GameSettings.BattleSpeed + "×", () =>
            {
                GameSettings.BattleSpeed = GameSettings.BattleSpeed == 1 ? 2 : 1;
                speedLabel.text = GameSettings.BattleSpeed + "×";
            });
            speedLabel = speed.GetComponentInChildren<Text>();
            var tp = IconButton(head, "◎", null);
            UI.SetEnabled(tp, false, 0.35f); // 전투 중에는 순간이동할 수 없다
            IconButton(head, "Ⅱ", () =>
            {
                if (!_playing && !_finished && !_leaving) Pause();
            });
            ScreenKit.BottomLine(head);
        }

        private static RectTransform IconButton(Transform parent, string label, Action onClick)
        {
            var b = UI.ButtonCard(parent, onClick, Theme.Bar, Theme.ButtonBorder, 10, UI.Pad(0), false, 0, 44, TextAnchor.MiddleCenter);
            UI.Size(b, height: 44, width: 44);
            UI.Label(b, label, 14, Theme.Text, true, TextAnchor.MiddleCenter);
            return b;
        }

        // ── 무대 ──

        private void BuildStage()
        {
            var bg = UI.Image(_stage, Theme.DungeonStage(_b.Floor), 0, "stage-bg");
            UI.Stretch(bg.rectTransform);
            var ground = UI.Image(_stage, Theme.DungeonLine(_b.Floor) * new Color(1, 1, 1, 0.35f), 0, "ground");
            ground.sprite = Sprites.GradientUp;
            var grt = ground.rectTransform;
            grt.anchorMin = new Vector2(0, 0);
            grt.anchorMax = new Vector2(1, 0);
            grt.pivot = new Vector2(0.5f, 0);
            grt.sizeDelta = new Vector2(0, 70);
            ScreenKit.BottomLine(_stage);

            // 나
            var p = _b.Player;
            Unit(-1, p, new Vector2(84, 158), 76, Shape.Circle, Theme.Hex("23324A"), Theme.BlueLight, 3, 130, "HP " + p.Hp + "/" + p.MaxHp, false);

            // 적
            var centers = EnemyCenters(_b.Enemies.Count);
            for (int i = 0; i < _b.Enemies.Count; i++)
            {
                var e = _b.Enemies[i];
                bool many = _b.Enemies.Count > 2;
                Shape shape = e.Role == 2 ? Shape.Hexagon : Shape.Square;
                float size = e.Role == 2 ? (_b.Enemies.Count > 1 ? 72 : 96) : e.Role == 1 ? 62 : 56;
                Color border = e.Role == 2 ? Theme.Hex("E0873A") : e.Role == 1 ? Theme.Gold : Theme.Hex("8A5A56");
                float borderW = e.Role == 0 ? 2 : 5;
                Color fill = e.Role == 2 ? Theme.Hex("3A1E1A") : Theme.Hex("33242A");
                string name = e.Role == 1 ? "★" + e.Name : e.Name;
                Unit(i, e, centers[Mathf.Min(i, centers.Length - 1)], size, shape, fill, border, borderW, many ? 94 : 130, name, true);
            }
        }

        private static Vector2[] EnemyCenters(int n)
        {
            switch (n)
            {
                case 1: return new[] { new Vector2(286, 150) };
                case 2: return new[] { new Vector2(286, 92), new Vector2(286, 220) };
                case 3: return new[] { new Vector2(242, 92), new Vector2(338, 92), new Vector2(290, 220) };
                default: return new[] { new Vector2(242, 92), new Vector2(338, 92), new Vector2(242, 220), new Vector2(338, 220) };
            }
        }

        private void Unit(int index, Combatant c, Vector2 center, float size, Shape shape, Color fill, Color border, float borderW,
            float width, string title, bool enemy)
        {
            var v = new UnitView { Center = center, Size = size, MaxHp = c.MaxHp };
            float top = center.y - size / 2f;
            int hp = _hpBefore != null && _hpBefore.TryGetValue(index, out int h) ? h : c.Hp;
            bool alive = hp > 0;

            var name = UI.Label(_stage, title, enemy ? 11 : 12, alive ? Theme.Text : Theme.TextSub, !enemy, TextAnchor.MiddleCenter, false, false);
            Place(name.rectTransform, new Vector2(center.x - width / 2f, top - (enemy ? 44 : 30)), new Vector2(width, 16));
            if (!enemy) v.HpText = name;
            else
            {
                // 적 HP 숫자 (이름과 막대 사이)
                var hpText = UI.Label(_stage, "", 10, Theme.RedLight, false, TextAnchor.MiddleCenter, false, false);
                Place(hpText.rectTransform, new Vector2(center.x - width / 2f, top - 28), new Vector2(width, 14));
                v.HpText = hpText;
                v.EnemyHp = true;
            }

            var track = UI.Image(_stage, Theme.Line, 3, "hp");
            float barW = Mathf.Min(width - 10, 86);
            Place(track.rectTransform, new Vector2(center.x - barW / 2f, top - 12), new Vector2(barW, 6));
            var bar = UI.Image(track.transform, enemy ? Theme.Red : Theme.Green, 3, "fill");
            v.Bar = bar.rectTransform;
            v.Bar.anchorMin = Vector2.zero;
            v.Bar.offsetMin = Vector2.zero;
            v.Bar.offsetMax = Vector2.zero;
            SetBar(v, hp);

            // 도형 (선택 표시 → 테두리 → 채움). 도형 안에는 글자를 넣지 않는다 (수정 사항 #4)
            var root = UI.Rect(_stage, "shape");
            root.anchorMin = root.anchorMax = new Vector2(0, 1);
            root.pivot = new Vector2(0.5f, 0.5f);
            root.sizeDelta = new Vector2(size, size);
            root.anchoredPosition = new Vector2(center.x, -center.y);
            v.Shape = root;
            v.Group = root.gameObject.AddComponent<CanvasGroup>();
            bool selected = enemy && index == _target && alive && !_b.IsOver;
            if (selected)
            {
                var ring = ShapeImage(root, shape, Theme.Gold, -7);
                ring.gameObject.AddComponent<Blink>().Period = 1.4f;
            }
            ShapeImage(root, shape, border, 0);
            v.Fill = ShapeImage(root, shape, fill, borderW);
            if (selected || (enemy && Anchors.Get("battle.enemy0") == null && alive)) Anchors.Set("battle.enemy0", root);
            if (!alive) v.Group.alpha = 0.3f;

            if (enemy && alive)
            {
                var hit = root.gameObject.AddComponent<Image>();
                hit.color = new Color(0, 0, 0, 0);
                var btn = root.gameObject.AddComponent<Button>();
                btn.transition = Selectable.Transition.None;
                int idx = index;
                btn.onClick.AddListener(() => SelectTarget(idx));
            }

            // 상태 이상 (도형 아래)
            if (c.Alive && c.Statuses.Visible().Count > 0)
            {
                var tags = UI.Row(_stage, 3, null, TextAnchor.MiddleCenter, "status");
                tags.anchorMin = tags.anchorMax = new Vector2(0, 1);
                tags.pivot = new Vector2(0.5f, 1);
                tags.anchoredPosition = new Vector2(center.x, -(center.y + size / 2f + 5));
                var fit = tags.gameObject.AddComponent<ContentSizeFitter>();
                fit.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
                fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
                int n = 0;
                foreach (var s in c.Statuses.Visible())
                {
                    if (n++ >= 3) break; // 칸이 좁아 3개까지만
                    bool debuff = StatusContainer.IsDebuff(s.Type);
                    UI.Pill(tags, Names.Of(s.Type) + s.Turns, debuff ? Theme.Red : Theme.Blue, debuff ? Theme.RedLight : Theme.BlueLight, 10, 6);
                }
            }
            _units[index] = v;
        }

        private static Image ShapeImage(RectTransform parent, Shape shape, Color color, float inset)
        {
            var img = UI.Image(parent, color, 0, "shape-layer");
            switch (shape)
            {
                case Shape.Circle:
                    img.sprite = Sprites.Circle;
                    break;
                case Shape.Hexagon:
                    img.sprite = Sprites.Hexagon;
                    break;
                default:
                    img.sprite = Sprites.Rounded;
                    img.type = Image.Type.Sliced;
                    img.pixelsPerUnitMultiplier = Sprites.MultiplierFor(8);
                    break;
            }
            UI.Stretch(img.rectTransform, inset, inset, inset, inset);
            return img;
        }

        private static void SetBar(UnitView v, int hp)
        {
            float ratio = v.MaxHp <= 0 ? 0 : Mathf.Clamp01((float)hp / v.MaxHp);
            v.Bar.anchorMax = new Vector2(ratio, 1);
            v.Bar.GetComponent<Image>().enabled = ratio > 0.001f;
            if (v.HpText != null) v.HpText.text = (v.EnemyHp ? "" : "HP ") + Mathf.Max(0, hp) + "/" + v.MaxHp;
        }

        private static void Place(RectTransform rt, Vector2 topLeft, Vector2 size)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0, 1);
            rt.sizeDelta = size;
            rt.anchoredPosition = new Vector2(topLeft.x, -topLeft.y);
        }

        private void SelectTarget(int index)
        {
            if (_playing || _finished || _leaving || index == _target) return;
            _target = index;
            Rebuild();
        }

        // ── 기록 (최근 3줄) ──

        private void Log(Transform parent)
        {
            var bg = UI.Card(parent, Theme.Log, Theme.Log, 0.01f, UI.Pad(16, 16, 8, 8), true, 2, TextAnchor.LowerLeft, "log");
            UI.Size(bg, height: 74);
            bg.gameObject.AddComponent<RectMask2D>(); // 긴 줄이 넘치면 위쪽 오래된 줄부터 가려진다
            int start = Mathf.Max(0, _b.Log.Count - 3);
            for (int i = start; i < _b.Log.Count; i++)
            {
                var line = _b.Log[i];
                Color color = line.Tone == LogTone.Good ? Theme.Gold : line.Tone == LogTone.Bad ? Theme.RedLight : line.Tone == LogTone.System ? Theme.Text : Theme.TextLog;
                var t = UI.Label(bg, line.Text, 13, i == _b.Log.Count - 1 ? color : color * new Color(1, 1, 1, 0.7f), false, TextAnchor.MiddleLeft, false, false);
                t.horizontalOverflow = HorizontalWrapMode.Wrap;
                UI.Size(t, minH: 18);
            }
            ScreenKit.BottomLine(bg);
        }

        // ── 선택지 ──

        private void Choices(Transform parent)
        {
            var hint = UI.Row(parent);
            string targetName = _target >= 0 ? _b.Enemies[_target].Name : "";
            var hl = UI.Sub(hint, _target >= 0 ? "대상 " + UI.Color(targetName, Theme.GoldHex) + " · 적을 눌러 바꾸기" : "모든 선택은 1턴을 사용합니다");
            UI.Size(hl, flexW: 1);
            UI.Sub(hint, "길게 누르면 상세", TextAnchor.MiddleRight);
            var list = UI.Scroll(parent, out _, 6, UI.Pad(0, 2, 0, 0), null, 1);
            Anchors.Set("battle.choices", list.parent.parent);
            foreach (var ch in _b.GetChoices())
            {
                if (ch.Target >= 0 && ch.Target != _target) continue;
                var b = Choice(list, ch);
                if (ch.Kind == ActionKind.Attack && Anchors.Get("battle.choice0") == null) Anchors.Set("battle.choice0", b);
            }
            if (_playing) _choicesGroup.interactable = false;
        }

        // 선택지 종류별 색 (수정 사항 #18): 바탕은 어둡게 두고 왼쪽 막대와 작은 태그로만 구분해 눈이 피로하지 않게
        private static void KindStyle(BattleChoice ch, out string tag, out Color bar, out Color fill, out Color border)
        {
            switch (ch.Kind)
            {
                case ActionKind.Skill:
                    var def = SkillDb.Get(ch.SkillId);
                    tag = "스킬" + (def != null ? " · " + Names.Of(def.Tier) : "");
                    bar = Theme.Hex("7FA8D8"); fill = Theme.Hex("1A2130"); border = Theme.Hex("34465C");
                    break;
                case ActionKind.Item:
                    tag = "아이템";
                    bar = Theme.Hex("7DB38A"); fill = Theme.Hex("1A231E"); border = Theme.Hex("34503C");
                    break;
                case ActionKind.Flee:
                    tag = "도주";
                    bar = Theme.Hex("B07A70"); fill = Theme.Hex("221C1D"); border = Theme.Hex("4A3634");
                    break;
                case ActionKind.Attack:
                    tag = "기본 공격";
                    bar = Theme.Hex("A9A39A"); fill = Theme.Button; border = Theme.ButtonBorder;
                    break;
                default:
                    tag = "대기";
                    bar = Theme.Hex("6A6E78"); fill = Theme.Button; border = Theme.ButtonBorder;
                    break;
            }
        }

        private RectTransform Choice(Transform parent, BattleChoice ch)
        {
            string right = ch.Enabled ? (ch.Kind == ActionKind.Item || ch.Kind == ActionKind.Wait ? ch.Note : ScreenKit.Percent(ch.Chance)) : ch.Note;
            bool pct = ch.Enabled && ch.Kind != ActionKind.Item && ch.Kind != ActionKind.Wait;
            string label = ch.Label;
            if (ch.Target >= 0)
            {
                int cut = label.IndexOf(" · ", StringComparison.Ordinal);
                if (cut > 0) label = label.Substring(0, cut);
            }
            if (ch.Kind == ActionKind.Attack) label = "공격";
            // 예상 피해를 바로 보여 준다 (스킬은 효과 요약도 함께)
            string sub = string.IsNullOrEmpty(ch.DamageNote) ? null : ch.DamageNote;
            if (ch.Kind == ActionKind.Skill)
            {
                var def = SkillDb.Get(ch.SkillId);
                if (def != null) sub = sub == null ? def.Effect : sub + " · " + def.Effect;
            }
            KindStyle(ch, out string tag, out Color barColor, out Color fill, out Color border);
            var b = UI.ButtonCard(parent, null, fill, border, 10, UI.Pad(18, 12, 6, 6), false, 10, sub != null ? 60 : 52);
            var bar = UI.Image(b, barColor, 2, "kind-bar");
            bar.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            var brt = bar.rectTransform;
            brt.anchorMin = new Vector2(0, 0);
            brt.anchorMax = new Vector2(0, 1);
            brt.pivot = new Vector2(0, 0.5f);
            brt.sizeDelta = new Vector2(4, -14);
            brt.anchoredPosition = new Vector2(7, 0);
            var left = UI.Column(b, 1, null, TextAnchor.MiddleLeft);
            UI.Size(left, flexW: 1);
            UI.Label(left, tag, 11, barColor, true);
            UI.Label(left, label, 15, Theme.Text, true);
            if (sub != null) UI.Label(left, sub, 12, Theme.TextBody);
            if (!string.IsNullOrEmpty(right))
                UI.Label(b, right, pct ? 15 : 12, pct ? Theme.Gold : Theme.TextSub, pct, TextAnchor.MiddleRight, false, false);
            var c = ch;
            LongPress.Add(b, () => ShowDetail(c), () => Pick(c));
            if (!ch.Enabled)
            {
                // 비활성 선택지는 흐리게, 길게 눌러 설명은 볼 수 있게
                var group = b.gameObject.AddComponent<CanvasGroup>();
                group.alpha = 0.5f;
                b.GetComponent<Button>().interactable = false;
            }
            return b;
        }

        private void ShowDetail(BattleChoice ch)
        {
            string text = string.IsNullOrEmpty(ch.Detail) ? ch.Note : ch.Detail;
            var body = Overlay.Modal(ch.Label, text.Length > 260);
            var t = UI.Label(body, text, 14, Theme.TextBody);
            t.lineSpacing = 1.3f;
        }

        private void Pick(BattleChoice ch)
        {
            if (_playing || _finished || _leaving || !ch.Enabled) return;
            if (ch.Kind == ActionKind.Item)
            {
                ItemMenu();
                return;
            }
            Execute(ch);
        }

        private void ItemMenu()
        {
            var body = Overlay.Modal("아이템 사용", true);
            var modal = Overlay.Top;
            UI.Sub(body, "아이템 사용도 1턴을 씁니다.");
            foreach (var ch in _b.GetItemChoices())
            {
                var c = ch;
                ScreenKit.ChoiceButton(body, ch.Label, null, ch.Note, false, () =>
                {
                    Overlay.Close(modal);
                    Execute(c);
                }, ch.Enabled);
            }
        }

        private void Execute(BattleChoice ch)
        {
            _hpBefore = new Dictionary<int, int> { [-1] = _b.Player.Hp };
            for (int i = 0; i < _b.Enemies.Count; i++) _hpBefore[i] = _b.Enemies[i].Hp;
            S.ExecuteBattle(ch);
            _pending = new List<BattleEvent>(_b.LastEvents);
            Rebuild();
        }

        // ── 연출 재생 ──

        /// <summary>시작과 동시에 일어난 사건(기습)의 이전 HP를 사건에서 거꾸로 계산한다.</summary>
        private Dictionary<int, int> InferBefore(List<BattleEvent> events)
        {
            var d = new Dictionary<int, int>();
            foreach (var e in events)
            {
                if (d.ContainsKey(e.Target)) continue;
                var who = e.Target < 0 ? _b.Player : e.Target < _b.Enemies.Count ? _b.Enemies[e.Target] : null;
                if (who == null) continue;
                if (e.Kind == BattleEventKind.Damage) d[e.Target] = Mathf.Min(who.MaxHp, e.HpAfter + e.Amount);
                else if (e.Kind == BattleEventKind.Heal) d[e.Target] = Mathf.Max(0, e.HpAfter - e.Amount);
                else if (e.Kind == BattleEventKind.Miss) d[e.Target] = e.HpAfter;
            }
            return d;
        }

        private void StartPlayback(List<BattleEvent> events)
        {
            _playing = true;
            if (_choicesGroup != null) _choicesGroup.interactable = false;
            Delay.Run(_stage, 0.05f, () => PlayNext(events, 0));
        }

        private void PlayNext(List<BattleEvent> events, int i)
        {
            if (_stage == null) return; // 화면이 바뀌었다
            if (i >= events.Count)
            {
                EndPlayback();
                return;
            }
            var e = events[i];
            float wait = StepTime;
            switch (e.Kind)
            {
                case BattleEventKind.Act:
                    if (_units.TryGetValue(e.Actor, out var actor))
                        Dash.Play(actor.Shape, new Vector2(e.Actor < 0 ? 34 : -28, 0));
                    if (!string.IsNullOrEmpty(e.Text)) Float(e.Actor, e.Text, Theme.Gold, 13, false);
                    wait = StepTime * 0.6f;
                    break;
                case BattleEventKind.Damage:
                    if (_units.TryGetValue(e.Target, out var hitUnit))
                    {
                        Shake.Play(hitUnit.Shape, e.Damage == DamageKind.Crit ? 10 : 6);
                        Flash.Play(hitUnit.Fill, e.Target < 0 ? Theme.Red : Color.white);
                        SetBar(hitUnit, e.HpAfter);
                    }
                    bool crit = e.Damage == DamageKind.Crit;
                    Float(e.Target, (crit ? "치명타! " : "") + e.Amount, Theme.DamageColor(e.Damage), crit ? 26 : 19, true);
                    if (crit && e.Actor == -1) Feedback.Vibrate();
                    if (e.Target < 0 && e.Actor >= 0) Feedback.Vibrate();
                    break;
                case BattleEventKind.Miss:
                    Float(e.Target, "빗나감", Theme.TextSub, 15, false);
                    break;
                case BattleEventKind.Heal:
                    if (_units.TryGetValue(e.Target, out var healUnit)) SetBar(healUnit, e.HpAfter);
                    Float(e.Target, "+" + e.Amount, Theme.DamageColor(DamageKind.Heal), 19, true);
                    break;
                case BattleEventKind.Status:
                    Float(e.Target, e.Text, Theme.BlueLight, 13, false);
                    wait = StepTime * 0.6f;
                    break;
                case BattleEventKind.Defeat:
                    if (_units.TryGetValue(e.Target, out var dead)) dead.Group.alpha = 0.3f;
                    break;
                default:
                    Float(e.Actor, e.Text, Theme.Gold, 16, true);
                    break;
            }
            Delay.Run(_stage, wait, () => PlayNext(events, i + 1), true);
        }

        private void Float(int index, string text, Color color, float size, bool bold)
        {
            if (string.IsNullOrEmpty(text) || !_units.TryGetValue(index, out var u)) return;
            var t = UI.Label(_stage, text, size, color, bold, TextAnchor.MiddleCenter, false, false);
            var outline = t.gameObject.AddComponent<Outline>();
            outline.effectColor = new Color(0, 0, 0, 0.85f);
            outline.effectDistance = new Vector2(1.5f, -1.5f);
            var rt = t.rectTransform;
            rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(160, 30);
            float jitter = UnityEngine.Random.Range(-10f, 10f);
            rt.anchoredPosition = new Vector2(Mathf.Clamp(u.Center.x + jitter, 60, StageW - 60), -(u.Center.y - u.Size * 0.15f));
            t.gameObject.AddComponent<FloatUp>();
        }

        private void EndPlayback()
        {
            _playing = false;
            _hpBefore = null;
            switch (_b.Outcome)
            {
                case BattleOutcome.Victory:
                    _finished = true;
                    if (S.LastLoot != null && S.LastLoot.LevelsGained > 0) Feedback.Vibrate();
                    Rebuild();
                    Delay.Run(_stage, 1.8f, Continue);
                    break;
                case BattleOutcome.Defeat:
                    _leaving = true; // 이동 전 잠깐 동안 다시 그리면 이동이 사라지므로 입력을 막는다
                    Delay.Run(_stage, 0.8f, () => Go(new ResultScreen(S.LastDeath != null && S.LastDeath.HardcoreReset ? ResultKind.Hardcore : ResultKind.Death)));
                    break;
                case BattleOutcome.Fled:
                    _leaving = true;
                    Delay.Run(_stage, 0.4f, () => Go(new DungeonScreen()));
                    break;
                default:
                    FixTarget();
                    Rebuild();
                    break;
            }
        }

        // ── 승리 ──

        private void Finished(Transform parent)
        {
            var card = UI.ButtonCard(parent, Continue, Theme.AccentBg, Theme.Accent, 12, UI.Pad(14, 12), true, 6, 60);
            UI.Label(card, _b.IsBoss ? "보스를 쓰러뜨렸다!" : "승리!", 20, Theme.Gold, false, TextAnchor.MiddleLeft, true);
            var loot = S.LastLoot;
            if (loot != null)
            {
                UI.Label(card, loot.Describe(), 14, Theme.Text);
                if (loot.LevelsGained > 0) UI.Label(card, "레벨 업! Lv." + _b.Character.Level + " · 능력치 포인트 +" + loot.LevelsGained * GameBalance.PointsPerLevel, 14, Theme.Gold, true);
            }
            if (_b.IsBoss) UI.Sub(card, "돌파 층 " + _b.Character.HighestFloorCleared + " · 다음 층이 열렸다");
            UI.Sub(card, "잠시 후 던전으로 돌아갑니다 · 눌러서 바로 계속");
        }

        private void Continue()
        {
            if (_leaving) return;
            _leaving = true;
            int levels = S.LastLoot?.LevelsGained ?? 0;
            S.CloseBattle();
            if (S.JustClearedGame)
            {
                S.JustClearedGame = false;
                Go(new ResultScreen(ResultKind.Clear));
                return;
            }
            if (S.InDungeon && S.PendingEvent == null) Go(new DungeonScreen(levels > 0));
            else App.GoToCurrent();
        }

        private void Pause()
        {
            var body = Overlay.Modal("일시정지");
            var modal = Overlay.Top;
            UI.Sub(body, "전투 중에 앱을 끄면, 다시 켰을 때 이 방의 전투를 처음부터 다시 시작합니다.");
            UI.TextButton(body, "계속하기", () => Overlay.Close(modal), ButtonKind.Primary);
            UI.TextButton(body, "설정", () =>
            {
                Overlay.Close(modal);
                SpeedSettings();
            }, ButtonKind.Secondary);
            UI.TextButton(body, "저장하고 타이틀로", () =>
            {
                S.Save();
                Go(new TitleScreen());
            }, ButtonKind.Ghost);
        }

        private void SpeedSettings()
        {
            var body = Overlay.Modal("전투 설정");
            UI.TextButton(body, "전투 속도 " + (GameSettings.BattleSpeed == 1 ? "1× → 2×" : "2× → 1×"), () =>
            {
                GameSettings.BattleSpeed = GameSettings.BattleSpeed == 1 ? 2 : 1;
                Overlay.CloseAll();
                Rebuild();
            });
            UI.TextButton(body, "진동 " + (GameSettings.Vibration ? "끄기" : "켜기"), () =>
            {
                GameSettings.Vibration = !GameSettings.Vibration;
                Overlay.CloseAll();
            });
        }
    }
}
