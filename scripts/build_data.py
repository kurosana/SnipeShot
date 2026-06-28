#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PokeAPI CSV -> ねらいうちゲーム用 JSON ビルドスクリプト

メガシンカ・フォルムチェンジ:
  - デフォルト形態と覚える技が異なる形態は別エントリとして追加
  - 覚える技が同じ形態はデフォルトに統合（進化ライン側で同一技セットとしてグループ化）

覚える技の引き継ぎ:
  - 進化後は進化前（およびその前）の覚える技をすべて引き継ぐ
  - 進化前には進化後の技は含めない
  - 地域フォルム（アローラ・ガラル・ヒスイ・パルデア）の進化ラインは
    同じ地域フォルムの進化元からのみ引き継ぐ（例: ガラルヒヒダルマ←ガラルダルマッカのみ）
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

REGIONAL_BRANCHES = ("alola", "galar", "hisui", "paldea")


def regional_branch(form_identifier: str) -> str | None:
    if not form_identifier:
        return None
    parts = form_identifier.split("-")
    for branch in REGIONAL_BRANCHES:
        if branch in parts:
            return branch
    return None


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


def main() -> None:
    if not CSV_DIR.is_dir():
        print(f"ERROR: CSV directory not found: {CSV_DIR}", file=sys.stderr)
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    species_rows = read_csv("pokemon_species.csv")
    pokemon_rows = read_csv("pokemon.csv")

    species_evo: dict[int, int] = {}
    evolves_from: dict[int, int] = {}
    for row in species_rows:
        sid = to_int(row["id"])
        species_evo[sid] = to_int(row["evolution_chain_id"])
        parent = row.get("evolves_from_species_id", "").strip()
        if parent:
            evolves_from[sid] = to_int(parent)

    default_pokemon: dict[int, int] = {}
    pokemon_species: dict[int, int] = {}
    pokemon_identifier: dict[int, str] = {}
    species_to_pids: dict[int, list[int]] = defaultdict(list)
    for row in pokemon_rows:
        pid = to_int(row["id"])
        sid = to_int(row["species_id"])
        pokemon_species[pid] = sid
        pokemon_identifier[pid] = row["identifier"]
        species_to_pids[sid].append(pid)
        if to_int(row.get("is_default", "0")) == 1:
            default_pokemon[sid] = pid

    pokemon_to_form: dict[int, int] = {}
    pokemon_form_identifier: dict[int, str] = {}
    for row in read_csv("pokemon_forms.csv"):
        fid = to_int(row["id"])
        pid = to_int(row["pokemon_id"])
        pokemon_to_form[pid] = fid
        pokemon_form_identifier[fid] = (row.get("form_identifier") or "").strip()

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
        slot_best: dict[int, tuple[int, int]] = {}
        for gen, tid, slot in types_past.get(pid, []):
            if gen <= max_gen and (slot not in slot_best or gen >= slot_best[slot][0]):
                slot_best[slot] = (gen, tid)
        if slot_best:
            return [slot_best[s][1] for s in sorted(slot_best)]
        slots = cur_types.get(pid, [])
        return [tid for _, tid in sorted(slots)]

    def resolve_abilities(pid: int, max_gen: int) -> list[int]:
        slot_state: dict[int, tuple[int, int, int]] = {}
        for gen, aid, hidden, slot in sorted(abilities_past.get(pid, []), key=lambda x: x[0]):
            if gen <= max_gen:
                if aid:
                    slot_state[slot] = (gen, aid, hidden)
                elif slot in slot_state:
                    del slot_state[slot]
        if slot_state:
            return sorted({aid for _, aid, _ in slot_state.values()})
        return sorted({aid for _, aid, _ in cur_abilities.get(pid, [])})

    def resolve_stats(pid: int, max_gen: int) -> dict[str, int]:
        stats = {k: cur_stats.get(pid, {}).get(sid, 0) for sid, k in STAT_KEYS.items()}
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

    def pokemon_regional_branch(pid: int) -> str | None:
        fid = pokemon_to_form.get(pid)
        if fid is None:
            return None
        return regional_branch(pokemon_form_identifier.get(fid, ""))

    def pick_ancestor_pid(child_pid: int, parent_sid: int, vgs: list[int] | None) -> int | None:
        parent_default = default_pokemon.get(parent_sid)
        if parent_default is None:
            return None

        child_branch = pokemon_regional_branch(child_pid)
        if child_branch is None:
            return parent_default

        for cpid in candidate_pids_for_species(parent_sid, vgs):
            if pokemon_regional_branch(cpid) == child_branch:
                return cpid
        return None

    def moves_with_inheritance(pid: int, sid: int, vgs: list[int] | None) -> tuple[int, ...]:
        merged = set(moves_for_vgs(pid, vgs))
        current_sid = sid
        while current_sid in evolves_from:
            parent_sid = evolves_from[current_sid]
            parent_pid = pick_ancestor_pid(pid, parent_sid, vgs)
            if parent_pid is not None:
                merged |= set(moves_for_vgs(parent_pid, vgs))
            current_sid = parent_sid
        return tuple(sorted(merged))

    def resolve_display_name(pid: int, sid: int) -> str:
        default_pid = default_pokemon.get(sid)
        if default_pid is not None and pid != default_pid:
            fid = pokemon_to_form.get(pid)
            if fid:
                if fid in form_fullname_ja:
                    return form_fullname_ja[fid]
                if fid in form_label_ja:
                    base = names_ja.get(sid, f"#{sid}")
                    return f"{base}（{form_label_ja[fid]}）"
        return names_ja.get(sid, f"#{sid}")

    def pool_species(vgs: list[int] | None) -> set[int]:
        if vgs is None:
            return set(default_pokemon.keys())
        species_set: set[int] = set()
        for vg in vgs:
            for pid in moves_by_vg[vg]:
                sid = pokemon_species.get(pid)
                if sid and sid in default_pokemon:
                    species_set.add(sid)
        return species_set

    def candidate_pids_for_species(sid: int, vgs: list[int] | None) -> list[int]:
        if vgs is None:
            return species_to_pids.get(sid, [])
        found: set[int] = set()
        for vg in vgs:
            for pid in moves_by_vg[vg]:
                if pokemon_species.get(pid) == sid:
                    found.add(pid)
        return sorted(found)

    def make_entry(pid: int, sid: int, mode: dict) -> dict:
        moves = list(moves_with_inheritance(pid, sid, mode["vgs"]))
        return {
            "i": pid,
            "n": resolve_display_name(pid, sid),
            "t": resolve_types(pid, mode["max_gen"]),
            "a": resolve_abilities(pid, mode["max_gen"]),
            "s": resolve_stats(pid, mode["max_gen"]),
            "m": moves,
            "e": species_evo.get(sid, sid),
        }

    def build_species_entries(sid: int, mode: dict) -> list[dict]:
        default_pid = default_pokemon.get(sid)
        if default_pid is None:
            return []

        candidates = candidate_pids_for_species(sid, mode["vgs"])
        if not candidates and mode["vgs"] is None:
            candidates = [default_pid]

        default_moves = moves_for_vgs(default_pid, mode["vgs"])
        entries: list[dict] = []

        if default_moves or mode["vgs"] is None:
            entries.append(make_entry(default_pid, sid, mode))

        for pid in candidates:
            if pid == default_pid:
                continue
            form_moves = moves_for_vgs(pid, mode["vgs"])
            if mode["vgs"] is not None and not form_moves:
                continue
            if form_moves != default_moves:
                entries.append(make_entry(pid, sid, mode))

        return entries

    types_json = [
        {"id": tid, "name": type_names.get(tid, f"type{tid}"), "icon": TYPE_ICON.get(tid, "normal")}
        for tid in sorted(type_names)
        if tid in TYPE_ICON
    ]
    abilities_json = [{"id": aid, "name": name} for aid, name in sorted(ability_names.items())]
    moves_json = [{"id": mid, "name": name} for mid, name in sorted(move_names.items())]

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

    print(f"Done. {len(available_modes)} modes written to {OUT_DIR}")


if __name__ == "__main__":
    main()
