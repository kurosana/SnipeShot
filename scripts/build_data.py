#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PokeAPI CSV -> ねらいうちゲーム用 JSON ビルドスクリプト

進化・フォルムライン:
  - pokemon_evolution.csv の base_form_id / evolved_form_id からフォルム単位の進化グラフを構築
  - リーフ（進化終端）= 1ライン。分岐進化では共有の進化元が複数ラインに所属
  - 種族デフォルトとフォルム進化参加者のみ独立ノード。代替フォルムは種族ラインへ統合
  - リージョン亜種は同接頭辞の独立フォルムへ統合（ガラルダルマモード等）

除外:
  - トーテム / キョダイマックス / 空種族値 / ピカチュウキャップ系
  - ピカチュウおきがえ6種は専用ライン（本線とは別）

世代:
  - タイプ・種族値は過去CSVの世代スナップショットで上書き
  - 特性はスロット単位の過去上書き（既存ロジック）
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT.parent / "pokeapi-master" / "pokeapi-master" / "data" / "v2" / "csv"
OUT_DIR = ROOT / "data"
JA_LANG = 11

STAT_KEYS = {1: "hp", 2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe"}

TYPE_ICON = {
    1: "normal", 2: "fighting", 3: "flying", 4: "poison", 5: "ground",
    6: "rock", 7: "bug", 8: "ghost", 9: "steel", 10: "fire", 11: "water",
    12: "grass", 13: "electric", 14: "psychic", 15: "ice", 16: "dragon",
    17: "dark", 18: "fairy",
}

REGION_PREFIXES = ("alola", "galar", "hisui", "paldea")

FORM_TOKEN_JA = {
    "alola": "アローラ",
    "galar": "ガラル",
    "hisui": "ヒスイ",
    "paldea": "パルデア",
    "zen": "ダルマモード",
    "combat-breed": "コンバット種",
    "blaze-breed": "ブレイズ種",
    "aqua-breed": "アクア種",
}

PIKACHU_COSPLAY_PIDS = frozenset({10080, 10081, 10082, 10083, 10084, 10085})
PIKACHU_COSPLAY_LINE = 10085

MODES = [
    {"key": "all", "label": "全ポケモン全わざ", "max_gen": 9, "vgs": None},
    {"key": "gen1", "label": "1世代", "max_gen": 1, "vgs": [2]},
    {"key": "gen2", "label": "2世代", "max_gen": 2, "vgs": [4]},
    {"key": "gen3", "label": "3世代", "max_gen": 3, "vgs": [6, 7]},
    {"key": "gen4", "label": "4世代", "max_gen": 4, "vgs": [9, 10]},
    {"key": "gen5", "label": "5世代", "max_gen": 5, "vgs": [14]},
    {"key": "gen6", "label": "6世代", "max_gen": 6, "vgs": [16]},
    {"key": "gen7", "label": "7世代", "max_gen": 7, "vgs": [18]},
    {"key": "pikabui", "label": "ピカブイ", "max_gen": 7, "vgs": [19]},
    {"key": "gen8", "label": "8世代", "max_gen": 8, "vgs": [20, 21, 22]},
    {"key": "bdsp", "label": "BDSP", "max_gen": 8, "vgs": [23]},
    {"key": "arceus", "label": "アルセウス", "max_gen": 8, "vgs": [24]},
    {"key": "gen9", "label": "9世代", "max_gen": 9, "vgs": [25, 26, 27]},
    {"key": "za", "label": "ZA", "max_gen": 9, "vgs": [30]},
    {"key": "champions", "label": "チャンピオンズ", "max_gen": 9, "vgs": [32]},
]


def read_csv(name: str) -> list[dict[str, str]]:
    path = CSV_DIR / name
    if not path.exists():
        print(f"ERROR: missing {path}", file=sys.stderr)
        sys.exit(1)
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def to_int(v: str | None, default: int = 0) -> int:
    if v is None or v == "":
        return default
    return int(v)


def is_totem_form(identifier: str, form_identifier: str) -> bool:
    for value in (identifier, form_identifier):
        if "totem" in value.split("-"):
            return True
    return False


def is_gmax_form(form_identifier: str) -> bool:
    if not form_identifier:
        return False
    parts = form_identifier.split("-")
    return "gmax" in parts or "gigantamax" in parts


def is_pikachu_cap_form(form_identifier: str) -> bool:
    if not form_identifier:
        return False
    if form_identifier.endswith("-cap"):
        return True
    return form_identifier == "starter"


def composite_form_label(ident: str, form_label_ja: dict[int, str], fid: int) -> str | None:
    if not ident:
        return form_label_ja.get(fid)
    parts_ja: list[str] = []
    remaining = ident
    sorted_tokens = sorted(FORM_TOKEN_JA.keys(), key=len, reverse=True)
    while remaining:
        matched = False
        for tok in sorted_tokens:
            if remaining == tok or remaining.startswith(tok + "-"):
                parts_ja.append(FORM_TOKEN_JA[tok])
                remaining = remaining[len(tok) :].lstrip("-")
                matched = True
                break
        if not matched:
            break
    if len(parts_ja) >= 2:
        return "・".join(parts_ja)
    if fid in form_label_ja:
        return form_label_ja[fid]
    if len(parts_ja) == 1:
        return parts_ja[0]
    return None


def build_form_evolution_graph(
    evolution_rows: list[dict[str, str]],
    evolves_from: dict[int, int],
    default_pokemon: dict[int, int],
    pokemon_species: dict[int, int],
    pokemon_is_default: dict[int, bool],
    form_evo_participants: set[int],
    pokemon_to_form: dict[int, int],
    pokemon_form_identifier: dict[int, str],
    species_to_pids: dict[int, list[int]],
    excluded_pokemon: set[int],
) -> tuple[
    dict[int, list[int]],
    dict[int, list[int]],
    dict[int, int],
    dict[int, list[int]],
]:
    """フォルム進化グラフとライン所属を構築する。"""

    def form_ident_of(pid: int) -> str:
        fid = pokemon_to_form.get(pid)
        if fid is None:
            return ""
        return pokemon_form_identifier.get(fid, "")

    def is_independent_form(pid: int) -> bool:
        if pokemon_is_default.get(pid, False):
            return True
        if pid in form_evo_participants:
            return True
        return False

    def node_of(pid: int) -> int:
        if is_independent_form(pid):
            return pid
        sid = pokemon_species[pid]
        ident = form_ident_of(pid)
        for pref in REGION_PREFIXES:
            if ident.startswith(pref):
                for other in species_to_pids.get(sid, []):
                    if other == pid or other in excluded_pokemon:
                        continue
                    if not is_independent_form(other):
                        continue
                    if form_ident_of(other).startswith(pref):
                        return other
                break
        return default_pokemon[sid]

    children: dict[int, set[int]] = defaultdict(set)
    parents: dict[int, set[int]] = defaultdict(set)

    for row in evolution_rows:
        child_sid = to_int(row["evolved_species_id"])
        parent_sid = evolves_from.get(child_sid)
        if parent_sid is None:
            continue

        base_pid = to_int(row.get("base_form_id") or "") or default_pokemon.get(parent_sid)
        evolved_pid = to_int(row.get("evolved_form_id") or "") or default_pokemon.get(child_sid)
        if base_pid is None or evolved_pid is None:
            continue
        if base_pid in excluded_pokemon or evolved_pid in excluded_pokemon:
            continue

        parent_node = node_of(base_pid)
        child_node = node_of(evolved_pid)
        if parent_node == child_node:
            continue
        children[parent_node].add(child_node)
        parents[child_node].add(parent_node)

    leaf_memo: dict[int, frozenset[int]] = {}

    def leaves_of(node: int) -> frozenset[int]:
        if node in leaf_memo:
            return leaf_memo[node]
        kids = children.get(node, set())
        if not kids:
            leaf_memo[node] = frozenset({node})
            return leaf_memo[node]
        result: set[int] = set()
        for kid in kids:
            result |= leaves_of(kid)
        leaf_memo[node] = frozenset(result)
        return leaf_memo[node]

    pid_to_node: dict[int, int] = {}
    pid_to_lines: dict[int, list[int]] = {}
    all_pids = set(pokemon_species.keys()) - excluded_pokemon
    for pid in all_pids:
        node = node_of(pid)
        pid_to_node[pid] = node
        pid_to_lines[pid] = sorted(leaves_of(node))

    return (
        {k: sorted(v) for k, v in children.items()},
        {k: sorted(v) for k, v in parents.items()},
        pid_to_node,
        pid_to_lines,
    )


def main() -> None:
    if not CSV_DIR.is_dir():
        print(f"ERROR: CSV directory not found: {CSV_DIR}", file=sys.stderr)
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    species_rows = read_csv("pokemon_species.csv")
    pokemon_rows = read_csv("pokemon.csv")
    evolution_rows = read_csv("pokemon_evolution.csv")

    evolves_from: dict[int, int] = {}
    for row in species_rows:
        sid = to_int(row["id"])
        parent = row.get("evolves_from_species_id", "").strip()
        if parent:
            evolves_from[sid] = to_int(parent)

    default_pokemon: dict[int, int] = {}
    pokemon_species: dict[int, int] = {}
    species_to_pids: dict[int, list[int]] = defaultdict(list)
    pokemon_is_default: dict[int, bool] = {}
    for row in pokemon_rows:
        pid = to_int(row["id"])
        sid = to_int(row["species_id"])
        pokemon_species[pid] = sid
        species_to_pids[sid].append(pid)
        pokemon_is_default[pid] = to_int(row.get("is_default", "0")) == 1
        if pokemon_is_default[pid]:
            default_pokemon[sid] = pid

    pokemon_to_form: dict[int, int] = {}
    pokemon_form_identifier: dict[int, str] = {}
    form_is_default: dict[int, bool] = {}
    form_is_mega: dict[int, bool] = {}
    form_is_battle_only: dict[int, bool] = {}
    totem_pokemon: set[int] = set()
    excluded_pokemon: set[int] = set()
    for row in read_csv("pokemon_forms.csv"):
        fid = to_int(row["id"])
        pid = to_int(row["pokemon_id"])
        pokemon_to_form[pid] = fid
        form_ident = (row.get("form_identifier") or "").strip()
        pokemon_form_identifier[fid] = form_ident
        form_is_default[pid] = to_int(row.get("is_default", "0")) == 1
        form_is_mega[pid] = to_int(row.get("is_mega", "0")) == 1
        form_is_battle_only[pid] = to_int(row.get("is_battle_only", "0")) == 1
        if is_totem_form(
            (row.get("identifier") or "").strip(),
            form_ident,
        ):
            totem_pokemon.add(pid)
            excluded_pokemon.add(pid)
        if is_gmax_form(form_ident):
            excluded_pokemon.add(pid)
        if is_pikachu_cap_form(form_ident):
            excluded_pokemon.add(pid)

    form_evo_participants: set[int] = set()
    for row in evolution_rows:
        base = row.get("base_form_id", "").strip()
        evolved = row.get("evolved_form_id", "").strip()
        if base:
            form_evo_participants.add(to_int(base))
        if evolved:
            form_evo_participants.add(to_int(evolved))

    form_fullname_ja: dict[int, str] = {}
    form_label_ja: dict[int, str] = {}
    for row in read_csv("pokemon_form_names.csv"):
        if to_int(row["local_language_id"]) != JA_LANG:
            continue
        fid = to_int(row["pokemon_form_id"])
        form_name = (row.get("form_name") or "").strip()
        pokemon_name = (row.get("pokemon_name") or "").strip()
        if pokemon_name:
            form_fullname_ja[fid] = pokemon_name
        elif form_name:
            form_label_ja[fid] = form_name

    names_ja: dict[int, str] = {}
    for row in read_csv("pokemon_species_names.csv"):
        if to_int(row["local_language_id"]) == JA_LANG:
            names_ja[to_int(row["pokemon_species_id"])] = row["name"]

    type_names: dict[int, str] = {}
    for row in read_csv("type_names.csv"):
        if to_int(row["local_language_id"]) == JA_LANG:
            type_names[to_int(row["type_id"])] = row["name"]

    ability_names: dict[int, str] = {}
    for row in read_csv("ability_names.csv"):
        if to_int(row["local_language_id"]) == JA_LANG:
            ability_names[to_int(row["ability_id"])] = row["name"]

    move_names: dict[int, str] = {}
    for row in read_csv("move_names.csv"):
        if to_int(row["local_language_id"]) == JA_LANG:
            move_names[to_int(row["move_id"])] = row["name"]

    cur_types: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for row in read_csv("pokemon_types.csv"):
        pid = to_int(row["pokemon_id"])
        cur_types[pid].append((to_int(row["slot"]), to_int(row["type_id"])))

    types_past: dict[int, list[tuple[int, int, int]]] = defaultdict(list)
    for row in read_csv("pokemon_types_past.csv"):
        types_past[to_int(row["pokemon_id"])].append(
            (to_int(row["generation_id"]), to_int(row["type_id"]), to_int(row["slot"]))
        )

    cur_abilities: dict[int, list[tuple[int, int, int]]] = defaultdict(list)
    for row in read_csv("pokemon_abilities.csv"):
        cur_abilities[to_int(row["pokemon_id"])].append(
            (to_int(row["slot"]), to_int(row["ability_id"]), to_int(row["is_hidden"]))
        )

    abilities_past: dict[int, list[tuple[int, int, int, int]]] = defaultdict(list)
    for row in read_csv("pokemon_abilities_past.csv"):
        aid = row["ability_id"]
        abilities_past[to_int(row["pokemon_id"])].append(
            (
                to_int(row["generation_id"]),
                to_int(aid) if aid else 0,
                to_int(row["is_hidden"]),
                to_int(row["slot"]),
            )
        )

    cur_stats: dict[int, dict[int, int]] = defaultdict(dict)
    for row in read_csv("pokemon_stats.csv"):
        cur_stats[to_int(row["pokemon_id"])][to_int(row["stat_id"])] = to_int(row["base_stat"])

    for pid in pokemon_species:
        if pid not in excluded_pokemon and not cur_stats.get(pid):
            excluded_pokemon.add(pid)

    _, parents, pid_to_node, pid_to_lines = build_form_evolution_graph(
        evolution_rows,
        evolves_from,
        default_pokemon,
        pokemon_species,
        pokemon_is_default,
        form_evo_participants,
        pokemon_to_form,
        pokemon_form_identifier,
        species_to_pids,
        excluded_pokemon,
    )

    for pid in PIKACHU_COSPLAY_PIDS:
        if pid in pid_to_lines:
            pid_to_lines[pid] = [PIKACHU_COSPLAY_LINE]
            pid_to_node[pid] = PIKACHU_COSPLAY_LINE

    stats_past: dict[int, list[tuple[int, int, int]]] = defaultdict(list)
    for row in read_csv("pokemon_stats_past.csv"):
        stats_past[to_int(row["pokemon_id"])].append(
            (to_int(row["generation_id"]), to_int(row["stat_id"]), to_int(row["base_stat"]))
        )

    moves_by_vg: dict[int, dict[int, set[int]]] = defaultdict(lambda: defaultdict(set))
    all_moves_by_pokemon: dict[int, set[int]] = defaultdict(set)
    for row in read_csv("pokemon_moves.csv"):
        pid = to_int(row["pokemon_id"])
        vg = to_int(row["version_group_id"])
        mid = to_int(row["move_id"])
        moves_by_vg[vg][pid].add(mid)
        all_moves_by_pokemon[pid].add(mid)

    def resolve_types(pid: int, max_gen: int) -> list[int]:
        past = types_past.get(pid, [])
        cand = sorted({g for g, _t, _s in past if g >= max_gen})
        if cand:
            g0 = cand[0]
            slots = {s: t for g, t, s in past if g == g0}
            return [slots[s] for s in sorted(slots)]
        return [t for s, t in sorted(cur_types.get(pid, []))]

    def resolve_abilities(pid: int, max_gen: int) -> list[int]:
        slot_abilities: dict[int, int] = {
            slot: aid for slot, aid, _ in cur_abilities.get(pid, [])
        }
        slot_override: dict[int, tuple[int, int, int]] = {}
        for gen, aid, _hidden, slot in abilities_past.get(pid, []):
            if gen >= max_gen:
                if slot not in slot_override or gen < slot_override[slot][0]:
                    slot_override[slot] = (gen, aid, slot)
        for _gen, aid, slot in slot_override.values():
            if aid:
                slot_abilities[slot] = aid
            else:
                slot_abilities.pop(slot, None)
        return sorted(slot_abilities.values())

    def resolve_stats(pid: int, max_gen: int) -> dict[str, int]:
        stats = {k: cur_stats.get(pid, {}).get(sid, 0) for sid, k in STAT_KEYS.items()}
        by_stat: dict[int, list[tuple[int, int]]] = defaultdict(list)
        for g, sid, v in stats_past.get(pid, []):
            if sid in STAT_KEYS and g >= max_gen:
                by_stat[sid].append((g, v))
        for sid, lst in by_stat.items():
            g0 = min(lst, key=lambda x: x[0])[0]
            stats[STAT_KEYS[sid]] = next(v for g, v in lst if g == g0)
        special_hist: list[tuple[int, int]] = [
            (g, v) for g, sid, v in stats_past.get(pid, []) if sid == 9 and g <= max_gen
        ]
        if max_gen <= 2 and special_hist:
            sp = max(special_hist, key=lambda x: x[0])[1]
            stats["spa"] = sp
            stats["spd"] = sp
        stats["tot"] = sum(stats[k] for k in ("hp", "atk", "def", "spa", "spd", "spe"))
        return stats

    def moves_for_vgs(pid: int, vgs: list[int] | None) -> tuple[int, ...]:
        if vgs is None:
            return tuple(sorted(all_moves_by_pokemon.get(pid, set())))
        merged: set[int] = set()
        for vg in vgs:
            merged |= moves_by_vg.get(vg, {}).get(pid, set())
        return tuple(sorted(merged))

    def moves_with_inheritance(pid: int, vgs: list[int] | None) -> tuple[int, ...]:
        merged = set(moves_for_vgs(pid, vgs))
        node = pid_to_node[pid]
        seen: set[int] = {node}
        stack = list(parents.get(node, []))
        while stack:
            ancestor = stack.pop()
            if ancestor in seen:
                continue
            seen.add(ancestor)
            merged |= set(moves_for_vgs(ancestor, vgs))
            stack.extend(parents.get(ancestor, []))
        return tuple(sorted(merged))

    def resolve_display_name(pid: int, sid: int) -> str:
        base = names_ja.get(sid, f"#{sid}")
        fid = pokemon_to_form.get(pid)
        if not fid:
            return base
        if fid in form_fullname_ja:
            return form_fullname_ja[fid]
        ident = pokemon_form_identifier.get(fid, "")
        label = composite_form_label(ident, form_label_ja, fid)
        if label:
            return f"{base}（{label}）"
        return base

    def pool_species(vgs: list[int] | None) -> set[int]:
        if vgs is None:
            return set(default_pokemon.keys())
        species_set: set[int] = set()
        for vg in vgs:
            for pid in moves_by_vg[vg]:
                if pid in excluded_pokemon:
                    continue
                sid = pokemon_species.get(pid)
                if sid and sid in default_pokemon:
                    species_set.add(sid)
        return species_set

    def candidate_pids_for_species(sid: int, vgs: list[int] | None) -> list[int]:
        if vgs is None:
            return [pid for pid in species_to_pids.get(sid, []) if pid not in excluded_pokemon]
        found: set[int] = set()
        for vg in vgs:
            for pid in moves_by_vg[vg]:
                if pid in excluded_pokemon:
                    continue
                if pokemon_species.get(pid) == sid:
                    found.add(pid)
        return sorted(found)

    def entry_signature(pid: int, sid: int, mode: dict) -> tuple:
        return (
            tuple(resolve_types(pid, mode["max_gen"])),
            tuple(resolve_abilities(pid, mode["max_gen"])),
            tuple(sorted(resolve_stats(pid, mode["max_gen"]).items())),
            moves_with_inheritance(pid, mode["vgs"]),
        )

    def make_entry(pid: int, sid: int, mode: dict) -> dict:
        return {
            "i": pid,
            "n": resolve_display_name(pid, sid),
            "t": resolve_types(pid, mode["max_gen"]),
            "a": resolve_abilities(pid, mode["max_gen"]),
            "s": resolve_stats(pid, mode["max_gen"]),
            "m": list(moves_with_inheritance(pid, mode["vgs"])),
            "e": pid_to_lines[pid],
        }

    def build_species_entries(sid: int, mode: dict) -> list[dict]:
        default_pid = default_pokemon.get(sid)
        if default_pid is None:
            return []

        candidates = candidate_pids_for_species(sid, mode["vgs"])
        if not candidates and mode["vgs"] is None:
            candidates = [default_pid]

        by_sig: dict[tuple, int] = {}
        for pid in candidates:
            if mode["vgs"] is not None and not moves_for_vgs(pid, mode["vgs"]):
                continue
            sig = entry_signature(pid, sid, mode)
            if sig not in by_sig:
                by_sig[sig] = pid
            elif pid == default_pid:
                by_sig[sig] = pid

        return [make_entry(by_sig[sig], sid, mode) for sig in sorted(by_sig)]

    learnable_move_ids: set[int] = set()
    for mids in all_moves_by_pokemon.values():
        learnable_move_ids.update(mids)

    types_json = [
        {"id": tid, "name": type_names.get(tid, f"type{tid}"), "icon": TYPE_ICON.get(tid, "normal")}
        for tid in sorted(type_names)
        if tid in TYPE_ICON
    ]
    abilities_json = [{"id": aid, "name": name} for aid, name in sorted(ability_names.items())]
    moves_json = [
        {"id": mid, "name": move_names[mid]}
        for mid in sorted(move_names)
        if mid in learnable_move_ids
    ]

    with (OUT_DIR / "types.json").open("w", encoding="utf-8") as f:
        json.dump(types_json, f, ensure_ascii=False, separators=(",", ":"))
    with (OUT_DIR / "abilities.json").open("w", encoding="utf-8") as f:
        json.dump(abilities_json, f, ensure_ascii=False, separators=(",", ":"))
    with (OUT_DIR / "moves.json").open("w", encoding="utf-8") as f:
        json.dump(moves_json, f, ensure_ascii=False, separators=(",", ":"))

    available_modes = []
    for mode in MODES:
        vgs = mode["vgs"]
        pool = pool_species(vgs)
        if vgs is not None and not pool:
            print(f"SKIP {mode['key']}: no pokemon in version groups {vgs}")
            continue

        pokemon_list: list[dict] = []
        for sid in sorted(pool):
            pokemon_list.extend(build_species_entries(sid, mode))

        if not pokemon_list:
            print(f"SKIP {mode['key']}: empty pokemon list")
            continue

        mode_file = OUT_DIR / f"mode_{mode['key']}.json"
        with mode_file.open("w", encoding="utf-8") as f:
            json.dump(pokemon_list, f, ensure_ascii=False, separators=(",", ":"))

        available_modes.append({
            "key": mode["key"],
            "label": mode["label"],
            "file": mode_file.name,
            "count": len(pokemon_list),
        })
        print(f"OK mode_{mode['key']}.json: {len(pokemon_list)} entries")

    index = {"modes": available_modes, "stats": list(STAT_KEYS.values()) + ["tot"]}
    with (OUT_DIR / "index.json").open("w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"Excluded {len(excluded_pokemon)} forms (totem {len(totem_pokemon)}, gmax/cap/empty etc.)")
    print(f"Learnable moves: {len(moves_json)} / {len(move_names)}")
    print(f"Done. {len(available_modes)} modes written to {OUT_DIR}")


if __name__ == "__main__":
    main()
