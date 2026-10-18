using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Text;

namespace Adventure.Core
{
    /// <summary>
    /// 저장 파일용 작은 JSON 직렬화기. Unity와 테스트 양쪽에서 똑같이 동작하도록 리플렉션만 쓴다.
    /// 지원: 기본형, string, enum(이름), List&lt;T&gt;, 배열, public 인스턴스 필드를 가진 클래스. null 허용.
    /// 저장 파일에 없는 필드는 기본값을 유지하고, 모르는 필드는 무시한다 (버전 호환).
    /// </summary>
    public static class Json
    {
        public static string Serialize(object value)
        {
            var sb = new StringBuilder();
            Write(sb, value);
            return sb.ToString();
        }

        public static T Deserialize<T>(string json) => (T)Deserialize(json, typeof(T));

        public static object Deserialize(string json, Type type)
        {
            var reader = new Reader(json);
            object raw = reader.ReadValue();
            reader.SkipWhitespace();
            if (!reader.End) throw new FormatException("JSON 뒤에 남은 문자가 있습니다");
            return Convert(raw, type);
        }

        // ── 쓰기 ───────────────────────────────────────────────

        private static void Write(StringBuilder sb, object value)
        {
            if (value == null)
            {
                sb.Append("null");
                return;
            }
            var type = value.GetType();
            if (type == typeof(string)) WriteString(sb, (string)value);
            else if (type == typeof(bool)) sb.Append((bool)value ? "true" : "false");
            else if (type.IsEnum) WriteString(sb, value.ToString());
            else if (type == typeof(int) || type == typeof(long) || type == typeof(short) || type == typeof(byte))
                sb.Append(System.Convert.ToInt64(value).ToString(CultureInfo.InvariantCulture));
            else if (type == typeof(float) || type == typeof(double))
                sb.Append(System.Convert.ToDouble(value).ToString("R", CultureInfo.InvariantCulture));
            else if (value is IList list)
            {
                sb.Append('[');
                for (int i = 0; i < list.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    Write(sb, list[i]);
                }
                sb.Append(']');
            }
            else
            {
                sb.Append('{');
                bool first = true;
                foreach (var f in Fields(type))
                {
                    if (!first) sb.Append(',');
                    first = false;
                    WriteString(sb, f.Name);
                    sb.Append(':');
                    Write(sb, f.GetValue(value));
                }
                sb.Append('}');
            }
        }

        private static void WriteString(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char ch in s)
            {
                switch (ch)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (ch < 0x20) sb.Append("\\u").Append(((int)ch).ToString("x4"));
                        else sb.Append(ch);
                        break;
                }
            }
            sb.Append('"');
        }

        private static readonly Dictionary<Type, FieldInfo[]> FieldCache = new Dictionary<Type, FieldInfo[]>();

        private static FieldInfo[] Fields(Type type)
        {
            lock (FieldCache)
            {
                if (FieldCache.TryGetValue(type, out var cached)) return cached;
                var list = new List<FieldInfo>();
                foreach (var f in type.GetFields(BindingFlags.Public | BindingFlags.Instance))
                {
                    if (f.IsInitOnly || f.IsNotSerialized) continue;
                    list.Add(f);
                }
                var arr = list.ToArray();
                FieldCache[type] = arr;
                return arr;
            }
        }

        // ── 읽기: 먼저 Dictionary/List/기본형으로 파싱한 뒤 대상 타입으로 변환 ──

        private static object Convert(object raw, Type type)
        {
            if (raw == null) return type.IsValueType ? Activator.CreateInstance(type) : null;
            if (type == typeof(object)) return raw;
            if (type == typeof(string)) return raw as string ?? System.Convert.ToString(raw, CultureInfo.InvariantCulture);
            if (type == typeof(bool)) return raw is bool b ? b : false;
            if (type.IsEnum)
            {
                if (raw is string name && Enum.IsDefined(type, name)) return Enum.Parse(type, name);
                if (raw is double num) return Enum.ToObject(type, (long)num);
                return Activator.CreateInstance(type);
            }
            if (type == typeof(int)) return (int)ToDouble(raw);
            if (type == typeof(long)) return raw is long l ? l : (long)ToDouble(raw);
            if (type == typeof(short)) return (short)ToDouble(raw);
            if (type == typeof(byte)) return (byte)ToDouble(raw);
            if (type == typeof(float)) return (float)ToDouble(raw);
            if (type == typeof(double)) return ToDouble(raw);
            if (type.IsArray)
            {
                var src = raw as List<object> ?? new List<object>();
                var elem = type.GetElementType();
                var arr = Array.CreateInstance(elem, src.Count);
                for (int i = 0; i < src.Count; i++) arr.SetValue(Convert(src[i], elem), i);
                return arr;
            }
            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(List<>))
            {
                var src = raw as List<object> ?? new List<object>();
                var elem = type.GetGenericArguments()[0];
                var list = (IList)Activator.CreateInstance(type);
                foreach (var item in src) list.Add(Convert(item, elem));
                return list;
            }
            if (!(raw is Dictionary<string, object> obj)) return Activator.CreateInstance(type);
            object instance = Activator.CreateInstance(type);
            foreach (var f in Fields(type))
            {
                if (!obj.TryGetValue(f.Name, out object v)) continue;
                var converted = Convert(v, f.FieldType);
                // 배열 필드는 길이가 바뀌었을 수 있으니 기본 배열 길이에 맞춘다 (예: 능력치·장비 슬롯 추가)
                if (f.FieldType.IsArray && f.GetValue(instance) is Array def && converted is Array loaded && loaded.Length != def.Length)
                {
                    Array.Copy(loaded, def, Math.Min(loaded.Length, def.Length));
                    converted = def;
                }
                f.SetValue(instance, converted);
            }
            return instance;
        }

        private static double ToDouble(object raw)
        {
            if (raw is double d) return d;
            if (raw is long l) return l;
            if (raw is bool b) return b ? 1 : 0;
            if (raw is string s && double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out double p)) return p;
            return 0;
        }

        private sealed class Reader
        {
            private readonly string _s;
            private int _i;

            public Reader(string s)
            {
                _s = s ?? "";
            }

            public bool End => _i >= _s.Length;

            public void SkipWhitespace()
            {
                while (_i < _s.Length && char.IsWhiteSpace(_s[_i])) _i++;
            }

            public object ReadValue()
            {
                SkipWhitespace();
                if (End) throw new FormatException("JSON이 비어 있습니다");
                char c = _s[_i];
                switch (c)
                {
                    case '{': return ReadObject();
                    case '[': return ReadArray();
                    case '"': return ReadString();
                    case 't': Expect("true"); return true;
                    case 'f': Expect("false"); return false;
                    case 'n': Expect("null"); return null;
                    default: return ReadNumber();
                }
            }

            private void Expect(string word)
            {
                if (string.CompareOrdinal(_s, _i, word, 0, word.Length) != 0) throw new FormatException("JSON 형식 오류: " + _i);
                _i += word.Length;
            }

            private Dictionary<string, object> ReadObject()
            {
                var dict = new Dictionary<string, object>();
                _i++; // {
                SkipWhitespace();
                if (_s[_i] == '}')
                {
                    _i++;
                    return dict;
                }
                while (true)
                {
                    SkipWhitespace();
                    string key = ReadString();
                    SkipWhitespace();
                    if (_s[_i++] != ':') throw new FormatException("':' 가 필요합니다: " + _i);
                    dict[key] = ReadValue();
                    SkipWhitespace();
                    char c = _s[_i++];
                    if (c == '}') return dict;
                    if (c != ',') throw new FormatException("',' 가 필요합니다: " + _i);
                }
            }

            private List<object> ReadArray()
            {
                var list = new List<object>();
                _i++; // [
                SkipWhitespace();
                if (_s[_i] == ']')
                {
                    _i++;
                    return list;
                }
                while (true)
                {
                    list.Add(ReadValue());
                    SkipWhitespace();
                    char c = _s[_i++];
                    if (c == ']') return list;
                    if (c != ',') throw new FormatException("',' 가 필요합니다: " + _i);
                }
            }

            private string ReadString()
            {
                if (_s[_i] != '"') throw new FormatException("문자열이 필요합니다: " + _i);
                _i++;
                var sb = new StringBuilder();
                while (true)
                {
                    if (End) throw new FormatException("문자열이 끝나지 않았습니다");
                    char c = _s[_i++];
                    if (c == '"') return sb.ToString();
                    if (c != '\\')
                    {
                        sb.Append(c);
                        continue;
                    }
                    char e = _s[_i++];
                    switch (e)
                    {
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'u':
                            sb.Append((char)int.Parse(_s.Substring(_i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            _i += 4;
                            break;
                        default: sb.Append(e); break;
                    }
                }
            }

            private object ReadNumber()
            {
                int start = _i;
                while (_i < _s.Length && "+-0123456789.eE".IndexOf(_s[_i]) >= 0) _i++;
                string token = _s.Substring(start, _i - start);
                if (token.Length == 0) throw new FormatException("JSON 형식 오류: " + start);
                if (token.IndexOfAny(new[] { '.', 'e', 'E' }) < 0 && long.TryParse(token, NumberStyles.Integer, CultureInfo.InvariantCulture, out long l))
                    return l;
                return double.Parse(token, NumberStyles.Float, CultureInfo.InvariantCulture);
            }
        }
    }
}
