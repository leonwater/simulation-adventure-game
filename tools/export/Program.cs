using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Text;
using Adventure.Core;

// 웹 이식용 데이터 내보내기: C# 정적 표를 JSON으로 (필드 이름 그대로, enum은 이름).
// 사용: dotnet run -- <출력 폴더>
static class Export
{
    static void Main(string[] args)
    {
        if (args.Length > 1 && args[0] == "--save")
        {
            WriteSampleSave(args[1]);
            return;
        }
        if (args.Length > 1 && args[0] == "--load")
        {
            var store = new MemorySaveStore { Content = File.ReadAllText(args[1]) };
            var data = SaveSystem.Load(store);
            Console.WriteLine(data == null ? "읽기 실패" : "읽음: " + data.Character.Name + " Lv." + data.Character.Level + " " + data.Character.Job + " 던전=" + (data.Run != null) + " 방=" + (data.Run?.Map.Rooms.Count ?? 0));
            return;
        }
        string dir = args.Length > 0 ? args[0] : "out";
        Directory.CreateDirectory(dir);
        Write(dir, "skills.json", SkillDb.AllSkills);
        Write(dir, "monsters.json", new Dictionary<string, object> { ["Species"] = MonsterDb.AllSpecies, ["Themes"] = MonsterDb.Themes });
        Write(dir, "consumables.json", ItemDb.Consumables);
        Write(dir, "events.json", EventDb.All);
        var jobs = new List<object>();
        foreach (Job j in Enum.GetValues(typeof(Job))) jobs.Add(JobData.Get(j));
        Write(dir, "jobs.json", jobs);
        Write(dir, "balance.json", Balance());
        Console.WriteLine("내보냄: " + Path.GetFullPath(dir));
    }

    /// <summary>Unity 저장 형식 확인용 샘플 저장 파일 (웹 테스트가 이 파일을 읽어 본다).</summary>
    static void WriteSampleSave(string path)
    {
        var store = new MemorySaveStore();
        var s = new GameSession(store, () => new DateTime(2026, 10, 22, 9, 0, 0, DateTimeKind.Utc), 17);
        s.NewGame("검사", Job.Warrior, Difficulty.Normal);
        s.SetTutorial(TutorialStage.Done);
        Leveling.AddExp(s.C, 100 + 283 + 520 + 1000);
        Leveling.AutoAllocate(s.C);
        s.C.Gold = 4321;
        s.C.HighestFloorCleared = 3;
        s.C.Inventory.Add(ItemDb.CreateEnhanceStone(3));
        s.C.Inventory.Add(EquipmentFactory.Create(GearType.Ring, ItemGrade.Rare, 8, Job.Warrior, Stat.Strength));
        s.C.Inventory.Add(ItemDb.CreateSkillBook("w_guard"));
        SkillSystem.Learn(s.C, "w_guard");
        s.C.Storage.Add(ItemDb.CreateConsumable("potion_hi", 2));
        s.SelectFloor(2);
        s.EnterDungeon();
        s.Save();
        File.WriteAllText(path, store.Content, new UTF8Encoding(false));
        Console.WriteLine("저장 샘플: " + Path.GetFullPath(path));
    }

    static void Write(string dir, string name, object value)
    {
        var sb = new StringBuilder();
        Dump(sb, value);
        string json = sb.ToString();
        File.WriteAllText(Path.Combine(dir, name), json, new UTF8Encoding(false));
        Console.WriteLine(name + " " + json.Length / 1024 + "KB");
    }

    /// <summary>
    /// 읽기 전용 필드·프로퍼티까지 담는 덤프 (Json.Serialize는 저장용이라 readonly를 뺀다).
    /// enum은 이름, 숫자는 그대로, null은 null.
    /// </summary>
    static void Dump(StringBuilder sb, object v)
    {
        if (v == null) { sb.Append("null"); return; }
        var t = v.GetType();
        if (v is string str) Str(sb, str);
        else if (v is bool b) sb.Append(b ? "true" : "false");
        else if (t.IsEnum) Str(sb, v.ToString());
        else if (v is double d) sb.Append(d.ToString("R", System.Globalization.CultureInfo.InvariantCulture));
        else if (v is float f) sb.Append(((double)f).ToString("R", System.Globalization.CultureInfo.InvariantCulture));
        else if (t.IsPrimitive) sb.Append(Convert.ToInt64(v).ToString(System.Globalization.CultureInfo.InvariantCulture));
        else if (v is System.Collections.IDictionary dict)
        {
            sb.Append('{');
            bool first = true;
            foreach (System.Collections.DictionaryEntry e in dict)
            {
                if (!first) sb.Append(',');
                first = false;
                Str(sb, e.Key.ToString());
                sb.Append(':');
                Dump(sb, e.Value);
            }
            sb.Append('}');
        }
        else if (v is System.Collections.IEnumerable list)
        {
            sb.Append('[');
            bool first = true;
            foreach (var item in list)
            {
                if (!first) sb.Append(',');
                first = false;
                Dump(sb, item);
            }
            sb.Append(']');
        }
        else
        {
            sb.Append('{');
            bool first = true;
            foreach (var fi in t.GetFields(BindingFlags.Public | BindingFlags.Instance))
            {
                if (!first) sb.Append(',');
                first = false;
                Str(sb, fi.Name);
                sb.Append(':');
                Dump(sb, fi.GetValue(v));
            }
            foreach (var pi in t.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                if (pi.GetIndexParameters().Length > 0 || !pi.CanRead) continue;
                if (!first) sb.Append(',');
                first = false;
                Str(sb, pi.Name);
                sb.Append(':');
                Dump(sb, pi.GetValue(v));
            }
            sb.Append('}');
        }
    }

    static void Str(StringBuilder sb, string s)
    {
        sb.Append('"');
        foreach (char ch in s)
        {
            if (ch == '"') sb.Append("\\\"");
            else if (ch == '\\') sb.Append("\\\\");
            else if (ch == '\n') sb.Append("\\n");
            else if (ch < 0x20) sb.Append("\\u").Append(((int)ch).ToString("x4"));
            else sb.Append(ch);
        }
        sb.Append('"');
    }

    /// <summary>GameBalance의 const·static readonly 값 (배열 포함). 함수(공식)는 TS에서 다시 쓴다.</summary>
    static Dictionary<string, object> Balance()
    {
        var map = new Dictionary<string, object>();
        foreach (var f in typeof(GameBalance).GetFields(BindingFlags.Public | BindingFlags.Static))
        {
            object v = f.GetValue(null);
            if (v is TimeSpan) continue;
            map[f.Name] = v;
        }
        return map;
    }
}
