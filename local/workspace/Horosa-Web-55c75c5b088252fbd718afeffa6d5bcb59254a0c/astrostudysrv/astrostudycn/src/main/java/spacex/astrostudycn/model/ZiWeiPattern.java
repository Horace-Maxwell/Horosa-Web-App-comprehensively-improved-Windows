package spacex.astrostudycn.model;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.io.FileUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudycn.helper.ZiWeiHelper;

/**
 * 紫微格局自动识别引擎：读 ziweige.json，对命盘按条件原语判定命中格局。
 * 原语与短义均据公版古籍（全书/骨髓赋/太微赋/诸星问答）编排，自有实现。
 *
 * 三方四正(命) = {命, 财帛(命-4), 官禄(命+4), 迁移(命+6)}（与 ZWHouseSangHe.drawSangheLine 同偏移）。
 * 生年四化星取自 ZiWeiHelper.GanSihuaStars[生年干]，顺序 [禄,权,科,忌]。
 */
public class ZiWeiPattern {

	private static final Map<String, Object> RULES;
	private static final Map<String, Integer> HUA_IDX = new HashMap<String, Integer>();

	static {
		HUA_IDX.put("禄", 0);
		HUA_IDX.put("权", 1);
		HUA_IDX.put("科", 2);
		HUA_IDX.put("忌", 3);
		String json = FileUtility.getStringFromClassPath("spacex/astrostudycn/helper/ziweige.json");
		RULES = JsonUtility.toDictionary(json);
	}

	@SuppressWarnings("unchecked")
	public static List<Map<String, Object>> detect(ZiWeiChart c) {
		List<Map<String, Object>> res = new ArrayList<Map<String, Object>>();
		if (c == null || c.lifeHouseIndex < 0) {
			return res;
		}
		Ctx ctx = new Ctx(c);
		for (Map.Entry<String, Object> e : RULES.entrySet()) {
			Map<String, Object> rule = (Map<String, Object>) e.getValue();
			List<Object> conds = (List<Object>) rule.get("conditions");
			String logic = rule.get("logic") == null ? "AND" : String.valueOf(rule.get("logic"));
			boolean hit = "OR".equalsIgnoreCase(logic) ? anyTrue(conds, ctx) : allTrue(conds, ctx);
			if (!hit) {
				continue;
			}
			boolean broken = false;
			List<Object> breakers = (List<Object>) rule.get("breakers");
			if (breakers != null) {
				for (Object b : breakers) {
					if (eval((Map<String, Object>) b, ctx)) {
						broken = true;
						break;
					}
				}
			}
			Map<String, Object> out = new HashMap<String, Object>();
			out.put("name", e.getKey());
			out.put("category", rule.get("category"));
			out.put("duanyi", rule.get("duanyi"));
			out.put("source_ref", rule.get("source_ref"));
			out.put("broken", broken);
			// P2-2：把规则定义原样回传，供前端格局面板「命中详情」可读化展开（不改 eval，零风险）。
			out.put("logic", logic);
			out.put("conditions", rule.get("conditions"));
			out.put("breakers", rule.get("breakers"));
			res.add(out);
		}
		return res;
	}

	private static boolean allTrue(List<Object> conds, Ctx ctx) {
		if (conds == null) {
			return false;
		}
		for (Object o : conds) {
			if (!eval(asMap(o), ctx)) {
				return false;
			}
		}
		return true;
	}

	private static boolean anyTrue(List<Object> conds, Ctx ctx) {
		if (conds == null) {
			return false;
		}
		for (Object o : conds) {
			if (eval(asMap(o), ctx)) {
				return true;
			}
		}
		return false;
	}

	@SuppressWarnings("unchecked")
	private static boolean eval(Map<String, Object> cond, Ctx ctx) {
		if (cond == null) {
			return false;
		}
		String op = String.valueOf(cond.get("op"));
		if ("and".equals(op)) {
			return allTrue((List<Object>) cond.get("conditions"), ctx);
		}
		if ("or".equals(op)) {
			return anyTrue((List<Object>) cond.get("conditions"), ctx);
		}
		if ("inMing".equals(op)) {
			return ctx.idx(str(cond, "star")) == ctx.life;
		}
		if ("inTrine".equals(op)) {
			return ctx.trine.contains(ctx.idx(str(cond, "star")));
		}
		if ("inTrineAny".equals(op)) {
			int n = 0;
			int need = ConvertUtility.getValueAsInt(cond.get("atLeast"), 1);
			for (String s : list(cond, "stars")) {
				if (ctx.trine.contains(ctx.idx(s))) {
					n++;
				}
			}
			return n >= need;
		}
		if ("same".equals(op)) {
			int first = -2;
			for (String s : list(cond, "stars")) {
				int i = ctx.idx(s);
				if (i < 0) {
					return false;
				}
				if (first == -2) {
					first = i;
				} else if (i != first) {
					return false;
				}
			}
			return first >= 0;
		}
		if ("sameAnyOf".equals(op)) {
			int base = ctx.idx(str(cond, "star"));
			if (base < 0) {
				return false;
			}
			for (String s : list(cond, "others")) {
				if (ctx.idx(s) == base) {
					return true;
				}
			}
			return false;
		}
		if ("mingZhi".equals(op)) {
			return list(cond, "branches").contains(ctx.zhiOf(ctx.life));
		}
		if ("inZhi".equals(op)) {
			int i = ctx.idx(str(cond, "star"));
			return i >= 0 && list(cond, "branches").contains(ctx.zhiOf(i));
		}
		if ("sandwichMing".equals(op)) {
			List<String> ss = list(cond, "stars");
			return ss.size() == 2 && ctx.sandwich(ctx.life, ss.get(0), ss.get(1));
		}
		if ("sandwichStarMix".equals(op)) {
			int t = ctx.idx(str(cond, "target"));
			if (t < 0) {
				return false;
			}
			int left = (t + 11) % 12;
			int right = (t + 1) % 12;
			int si = ctx.idx(str(cond, "star"));
			int hi = ctx.huaHouse(str(cond, "hua"));
			return (si == left && hi == right) || (si == right && hi == left);
		}
		if ("bright".equals(op)) {
			int i = ctx.idx(str(cond, "star"));
			if (i < 0) {
				return false;
			}
			String lt = ZiWeiHelper.getStarLight(str(cond, "star"), ctx.zhiOf(i));
			return lt != null && list(cond, "levels").contains(lt);
		}
		if ("mingNoMainStar".equals(op)) {
			return ctx.c.houses[ctx.life].starsMain.isEmpty();
		}
		if ("huaMing".equals(op)) {
			return ctx.huaHouse(str(cond, "hua")) == ctx.life;
		}
		if ("huaTrineAll".equals(op)) {
			for (String h : list(cond, "huas")) {
				if (!ctx.trine.contains(ctx.huaHouse(h))) {
					return false;
				}
			}
			return true;
		}
		if ("huaWithStar".equals(op)) {
			int i = ctx.idx(str(cond, "star"));
			return i >= 0 && i == ctx.huaHouse(str(cond, "hua"));
		}
		if ("breakBy".equals(op)) {
			int qian = (ctx.life + 6) % 12;
			for (String s : list(cond, "stars")) {
				int i = ctx.idx(s);
				if (i == ctx.life || i == qian) {
					return true;
				}
			}
			return false;
		}
		// P2-3 新增 op：inOpp（对宫/迁移含某星）、sandwichHua（生年某化夹命）。
		if ("inOpp".equals(op)) {
			int opp = (ctx.life + 6) % 12;
			for (String s : list(cond, "stars")) {
				if (ctx.idx(s) == opp) {
					return true;
				}
			}
			return false;
		}
		if ("sandwichHua".equals(op)) {
			int l = (ctx.life + 11) % 12;
			int r = (ctx.life + 1) % 12;
			int hi = ctx.huaHouse(str(cond, "hua"));
			return hi == l || hi == r;
		}
		// WP-G 新增 op：noneInTrine（stars 全不在三方四正，负判「无辅拱」）、notInMing（某星不在命宫）。
		if ("noneInTrine".equals(op)) {
			for (String s : list(cond, "stars")) {
				if (ctx.trine.contains(ctx.idx(s))) {
					return false;
				}
			}
			return true;
		}
		if ("notInMing".equals(op)) {
			return ctx.idx(str(cond, "star")) != ctx.life;
		}
		return false;
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> asMap(Object o) {
		return o instanceof Map ? (Map<String, Object>) o : null;
	}

	private static String str(Map<String, Object> m, String k) {
		Object v = m.get(k);
		return v == null ? null : String.valueOf(v);
	}

	@SuppressWarnings("unchecked")
	private static List<String> list(Map<String, Object> m, String k) {
		List<String> r = new ArrayList<String>();
		Object v = m.get(k);
		if (v instanceof List) {
			for (Object o : (List<Object>) v) {
				r.add(String.valueOf(o));
			}
		}
		return r;
	}

	private static class Ctx {
		final ZiWeiChart c;
		final int life;
		final String yearGan;
		final Set<Integer> trine = new HashSet<Integer>();

		Ctx(ZiWeiChart c) {
			this.c = c;
			this.life = c.lifeHouseIndex;
			this.yearGan = c.yearGan;
			trine.add(life);
			trine.add((life - 4 + 12) % 12);
			trine.add((life + 4) % 12);
			trine.add((life + 6) % 12);
		}

		int idx(String star) {
			Integer i = c.starsHouseIndex.get(star);
			return i == null ? -1 : i.intValue();
		}

		String zhiOf(int houseIdx) {
			return c.houses[houseIdx].ganzi.substring(1);
		}

		boolean sandwich(int center, String a, String b) {
			int left = (center + 11) % 12;
			int right = (center + 1) % 12;
			int ia = idx(a);
			int ib = idx(b);
			return (ia == left && ib == right) || (ia == right && ib == left);
		}

		/** 生年化某化之星所落宫index（优先本盘自定义四化＝流派，回退全局表；-1=该化星未上盘）。 */
		int huaHouse(String hua) {
			if (c.mySihua != null && yearGan != null && hua != null) {
				Map<String, String> m = c.mySihua.get(yearGan);
				if (m != null) {
					for (Map.Entry<String, String> en : m.entrySet()) {
						if (hua.equals(en.getValue())) {
							return idx(en.getKey());
						}
					}
				}
			}
			String[] st = ZiWeiHelper.GanSihuaStars.get(yearGan);
			Integer hi = HUA_IDX.get(hua);
			if (st == null || hi == null || hi >= st.length) {
				return -1;
			}
			return idx(st[hi]);
		}
	}
}
