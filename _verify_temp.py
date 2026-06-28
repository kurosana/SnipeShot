import json
from pathlib import Path

base = Path("data")
with open(base / "mode_all.json", encoding="utf-8") as f:
    mode_all = json.load(f)
with open(base / "abilities.json", encoding="utf-8") as f:
    abilities_raw = json.load(f)
with open(base / "types.json", encoding="utf-8") as f:
    types_raw = json.load(f)

ab_by_id = {a["id"]: a["name"] for a in abilities_raw}

if isinstance(types_raw, list):
    type_by_id = {i: n for i, n in enumerate(types_raw)}
elif isinstance(types_raw, dict):
    type_by_id = {int(k): v for k, v in types_raw.items()}

entries = mode_all if isinstance(mode_all, list) else mode_all.get("pokemon", [])
by_id = {e["i"]: e for e in entries}

def type_names(i):
    e = by_id[i]
    t = e.get("t") or []
    return e.get("n", ""), [type_by_id.get(x, x) for x in t]

def ab_names(i):
    e = by_id[i]
    ab = e.get("a") or []
    return e.get("n", ""), [ab_by_id.get(x, x) for x in ab]

def get_e(i):
    e = by_id[i]
    return e.get("n", ""), e.get("e", [])

def line_ids(p):
    e = p.get("e")
    if isinstance(e, list):
        return e
    return [e] if e is not None else []

def count_results(hits):
    line_set = set()
    for p in hits:
        for lid in line_ids(p):
            line_set.add(lid)
    return len(line_set)

results = []

n, ans = ab_names(244)
ok1 = "せいしんりょく" in ans and "もらいび" not in ans
results.append(("1 Entei i=244 abilities", repr(ans), "含むせいしんりょく、不含もらいび", "OK" if ok1 else "NG"))

n, ans = ab_names(94)
results.append(("2 Gengar i=94 abilities", repr(ans), "(exact list)", "OK" if ans else "NG"))

n, ans = ab_names(145)
ok3 = "せいでんき" in ans and "プレッシャー" in ans
results.append(("3 Zapdos i=145 abilities", repr(ans), "せいでんき+プレッシャー", "OK" if ok3 else "NG"))

n, tn = type_names(35)
ok4 = "フェアリー" in tn and "ノーマル" not in tn
results.append(("4 Clefairy i=35 types", repr(tn), "フェアリー、非ノーマル", "OK" if ok4 else "NG"))

n25, tn25 = type_names(25)
results.append(("4b Pikachu i=25 types", repr(tn25), "info", "OK"))

for i in [74, 10109, 76, 10111]:
    name, e = get_e(i)
    results.append((f"5 Geodude i={i} e", repr(e), "", "OK"))

ok5 = get_e(76)[1] != get_e(10111)[1]
results.append(("5 Geodude 2 lines (76 vs 10111)", f"76={get_e(76)[1]} 10111={get_e(10111)[1]}", "different e", "OK" if ok5 else "NG"))

name, e = get_e(102)
results.append(("6 Exeggcute i=102 e", repr(e), "[103, 10114]", "OK" if e == [103, 10114] else "NG"))

for i, exp in [(211, [211]), (10234, [904]), (904, [904])]:
    name, e = get_e(i)
    results.append((f"7 Hisui i={i} e", repr(e), repr(exp), "OK" if e == exp else "NG"))

dex_ids = {386, 10001, 10002, 10003}
deox = sorted([e for e in entries if e["i"] in dex_ids], key=lambda x: x["i"])
results.append(("8 Deoxys entry count", str(len(deox)), "4", "OK" if len(deox)==4 else "NG"))
ok8all = all(x.get("e") == [386] for x in deox)
for x in deox:
    results.append((f"8 Deoxys i={x['i']} e", repr(x.get("e")), "[386]", "OK" if x.get("e")==[386] else "NG"))

gira = [e for e in entries if "ギラティナ" in e.get("n", "")]
es_g = {tuple(x.get("e", [])) for x in gira}
ok9 = len(es_g) == 1 and len(gira) > 0
results.append(("9 Giratina all same e", str(list(es_g)), "1 unique e", "OK" if ok9 else "NG"))
for x in gira:
    results.append((f"9 Giratina i={x['i']}", x["n"], repr(x.get("e")), "OK" if ok9 else "NG"))

hits = [by_id[76], by_id[10111]]
lines = count_results(hits)
ok10 = lines == 2
results.append(("10 FilterEngine lines count", str(lines), "2 (duel)", "OK" if ok10 else "NG"))

for row in results:
    print("\t".join(row))
