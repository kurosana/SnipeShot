/**
 * 絞り込みロジック
 */
const FilterEngine = {
  lineIds(p) {
    const e = p.e;
    if (Array.isArray(e)) return e;
    return e != null ? [e] : [];
  },

  /** 攻撃タイプ atkId が防御タイプ配列 defTypes に与える倍率（特性非考慮） */
  typeMultiplier(atkId, defTypes, chart) {
    const row = chart?.[String(atkId)];
    if (!row) return 1;
    let mult = 1;
    for (const defId of defTypes) {
      const f = row[String(defId)];
      mult *= f == null ? 1 : f;
    }
    return mult;
  },

  /** 相性カテゴリに倍率が見合うか */
  matchesEfficacyCategory(mult, effKey) {
    switch (effKey) {
      case "super":
        return mult >= 2;
      case "resist":
        return mult <= 0.5;
      case "x4":
        return mult === 4;
      case "x2":
        return mult === 2;
      case "x1":
        return mult === 1;
      case "x05":
        return mult === 0.5;
      case "x025":
        return mult <= 0.25;
      default:
        return false;
    }
  },

  applyAll(pokemon, conditions) {
    let result = pokemon;
    for (const cond of conditions) {
      if (cond.excluded) continue;
      if (!this.isComplete(cond)) continue;
      result = this.applyOne(result, cond);
    }
    return result;
  },

  isComplete(cond) {
    if (!cond.kind || !cond.op) return false;
    if (cond.kind === "type") return cond.typeId != null;
    if (cond.kind === "efficacy") {
      return (
        typeof cond.typeId === "number" &&
        !!cond.effKey &&
        ["super", "resist", "x4", "x2", "x1", "x05", "x025"].includes(cond.effKey)
      );
    }
    if (cond.kind === "ability") return cond.abilityId != null;
    if (cond.kind === "move") return cond.moveId != null;
    if (cond.kind === "egg") return cond.eggId != null;
    if (cond.kind === "stat") {
      return cond.statKey && cond.statValue !== "" && !Number.isNaN(Number(cond.statValue));
    }
    return false;
  },

  applyOne(pokemon, cond) {
    switch (cond.kind) {
      case "type":
        if (cond.typeId === "single") {
          return pokemon.filter((p) => {
            const isSingle = p.t.length === 1;
            return cond.op === "is_single" ? isSingle : !isSingle;
          });
        }
        return pokemon.filter((p) => {
          const has = p.t.includes(cond.typeId);
          return cond.op === "has" ? has : !has;
        });
      case "efficacy": {
        const chart =
          typeof DataStore !== "undefined" ? DataStore.typeEfficacy : cond._chart || {};
        return pokemon.filter((p) => {
          const mult = this.typeMultiplier(cond.typeId, p.t, chart);
          const match = this.matchesEfficacyCategory(mult, cond.effKey);
          return cond.op === "is" ? match : !match;
        });
      }
      case "ability":
        return pokemon.filter((p) => {
          const has = p.a.includes(cond.abilityId);
          return cond.op === "has" ? has : !has;
        });
      case "move":
        return pokemon.filter((p) => {
          const has = p.m.includes(cond.moveId);
          return cond.op === "learn" ? has : !has;
        });
      case "egg":
        return pokemon.filter((p) => {
          const groups = p.g || [];
          const has = groups.includes(cond.eggId);
          return cond.op === "is" ? has : !has;
        });
      case "stat": {
        const n = Number(cond.statValue);
        const key = cond.statKey;
        return pokemon.filter((p) => {
          const v = p.s[key] ?? 0;
          return cond.op === "gte" ? v >= n : v <= n;
        });
      }
      default:
        return pokemon;
    }
  },

  classifyHits(hits) {
    const singleton = new Set();
    const multi = [];
    for (const p of hits) {
      const lines = this.lineIds(p);
      if (lines.length === 1) {
        singleton.add(lines[0]);
      } else if (lines.length > 1) {
        multi.push({ p, lineSet: new Set(lines) });
      }
    }
    const absorbed = multi.filter(({ lineSet }) => [...lineSet].some((l) => singleton.has(l)));
    const remaining = multi.filter(({ lineSet }) => ![...lineSet].some((l) => singleton.has(l)));
    return { singleton, absorbed, remaining };
  },

  countMultiLineComponents(multiSets) {
    if (multiSets.length === 0) return 0;
    const parent = multiSets.map((_, i) => i);
    const find = (i) => {
      if (parent[i] !== i) parent[i] = find(parent[i]);
      return parent[i];
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    for (let i = 0; i < multiSets.length; i++) {
      for (let j = i + 1; j < multiSets.length; j++) {
        const shared = [...multiSets[i]].some((line) => multiSets[j].has(line));
        if (shared) union(i, j);
      }
    }
    const roots = new Set();
    for (let i = 0; i < multiSets.length; i++) roots.add(find(i));
    return roots.size;
  },

  partitionMultiByComponent(multiItems) {
    if (multiItems.length === 0) return [];
    const parent = multiItems.map((_, i) => i);
    const find = (i) => {
      if (parent[i] !== i) parent[i] = find(parent[i]);
      return parent[i];
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    for (let i = 0; i < multiItems.length; i++) {
      for (let j = i + 1; j < multiItems.length; j++) {
        const shared = [...multiItems[i].lineSet].some((line) => multiItems[j].lineSet.has(line));
        if (shared) union(i, j);
      }
    }
    const buckets = new Map();
    for (let i = 0; i < multiItems.length; i++) {
      const root = find(i);
      if (!buckets.has(root)) buckets.set(root, []);
      buckets.get(root).push(multiItems[i]);
    }
    return [...buckets.values()];
  },

  countResults(hits) {
    const { singleton, remaining } = this.classifyHits(hits);

    const byLine = new Map();
    for (const p of hits) {
      for (const lineId of this.lineIds(p)) {
        if (!byLine.has(lineId)) byLine.set(lineId, []);
        byLine.get(lineId).push(p);
      }
    }

    let evoFormLines = 0;
    for (const group of byLine.values()) {
      if (group.length >= 2) evoFormLines += 1;
    }

    const remainingSets = remaining.map(({ lineSet }) => lineSet);
    const multiComponents = this.countMultiLineComponents(remainingSets);
    const lines = singleton.size + multiComponents;

    return { count: hits.length, evoFormLines, lines };
  },

  groupHitsForDisplay(hits) {
    const { singleton, absorbed, remaining } = this.classifyHits(hits);
    const groups = new Map();

    const addTo = (key, p) => {
      if (!groups.has(key)) groups.set(key, []);
      const arr = groups.get(key);
      if (!arr.includes(p)) arr.push(p);
    };

    for (const p of hits) {
      const lines = this.lineIds(p);
      if (lines.length === 1) addTo(`line:${lines[0]}`, p);
    }

    for (const { p, lineSet } of absorbed) {
      const target = [...lineSet].filter((l) => singleton.has(l)).sort((a, b) => a - b)[0];
      addTo(`line:${target}`, p);
    }

    const comps = this.partitionMultiByComponent(remaining);
    comps.forEach((comp, i) => {
      for (const { p } of comp) addTo(`comp:${i}`, p);
    });

    return [...groups.values()].map((group) =>
      group.sort((a, b) => a.i - b.i).map((p) => p.n)
    );
  },

  shouldDuel(lines) {
    return lines === 2;
  },
};
