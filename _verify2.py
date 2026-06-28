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
type_by_id = {t["id"]: t["name"] for t in types_raw}
by_id = {e["i"]: e for e in mode_all}

lines_out = []
for i in [244, 94, 145]:
    e = by_id[i]
    lines_out.append(f"{i} {e['n']} abilities={[ab_by_id[x] for x in e['a']]}")
for i in [35, 25]:
    e = by_id[i]
    lines_out.append(f"{i} {e['n']} types={[type_by_id[x] for x in e['t']]}")

Path("_out.txt").write_text("\n".join(lines_out), encoding="utf-8")
