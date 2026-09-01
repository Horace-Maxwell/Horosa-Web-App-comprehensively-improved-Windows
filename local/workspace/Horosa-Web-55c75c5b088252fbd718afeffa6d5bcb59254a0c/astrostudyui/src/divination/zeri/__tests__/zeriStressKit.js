// [择日压测公共件] qimenZeriStress 校验器范式的技法无关抽象(测试专用 helper,非生产码)。
// 中心不变量:scan 的区间覆盖 ≡ 独立逐点真值(直接 computePanAt+evaluateTree,完全绕开
// 扫描器的折叠/递归分解/边界代码路径)——「找完结果和查找的对不上」在此必现形。
// 每行另断:良构(排序/不重叠/界内/分钟对齐/时长自洽)+边界四探针(起点真/终点前一分钟真/
// 两端外一分钟要么邻行覆盖要么必假)+行内同盘探针(行内随机分钟 plateKey ≡ 行首 plateKey,
// 抓「pass→pass 换盘未分行」型欠分裂——紫微 anchorMD 病即此型)。
const MIN = 60e3;

const pad2 = (n)=>(n < 10 ? `0${n}` : `${n}`);

export function makeZeriStressKit({
	name,
	scan,               // async ({cfg,geoParams,options,tree}) → {intervals,truncated}
	panAt,              // (geoParams, options, dateStr, timeStr) → pan(技法自备 scanCtx/缓存)
	evaluateTree,       // (compiled, pan) → {pass}
	compileTree,
	plateKeyOf,         // 可选:行内同盘探针用
	keyMaskOf,          // 可选:[十一轮] 掩码家(六壬/奇门/三式)必传——探针必须比「引擎
	                    // 实际折叠用的掩码 key」,比全位 key 会把合法的跨昼夜/跨柱合并行判假红
	offsetMin,          // 墙钟偏移(分)
	geo,
	baseOptions,
	defaultCfg,         // S1/S2/S3 缺省窗
	stepMs,             // 真值扫描步长(时辰盘=3600e3;日粒度技法自定)
}){
	const matrix = [];

	function wallMs(dateStr, timeStr){
		const [y, m, d] = dateStr.split('-').map(Number);
		const [hh, mm] = timeStr.split(':').map(Number);
		const dt = new Date(0);
		dt.setUTCFullYear(y, m - 1, d);
		dt.setUTCHours(hh, mm, 0, 0);
		return dt.getTime() - offsetMin * MIN;
	}
	function msWall(ms){
		const d = new Date(ms + offsetMin * MIN);
		return {
			date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
			time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00`,
		};
	}
	const panCache = new Map();
	function cachedPanAt(ms, options){
		const w = msWall(ms);
		const key = `${w.date} ${w.time}|${JSON.stringify(options)}`;
		if(!panCache.has(key)){
			panCache.set(key, panAt(geo, options, w.date, w.time));
		}
		return panCache.get(key);
	}
	function passAt(ms, compiled, options){
		const pan = cachedPanAt(ms, options);
		if(!pan){ return false; }	// 排盘失败=样本跳过(外壳契约同义)
		return !!evaluateTree(compiled, pan).pass;
	}
	const covered = (intervals, ms)=>intervals.some((r)=>r.startMs <= ms && ms < r.endMs);

	// 核心校验器。opts.skipProbes=true 用于日粒度技法(分钟探针语义不适用时自带探针)。
	async function scanAndSweep(id, uiRoot, optionsOverride, cfgOverride, opts){
		const cfg = cfgOverride || defaultCfg;
		const options = { ...baseOptions, ...(optionsOverride || {}) };
		const compiled = compileTree(uiRoot);
		const res = await scan({ cfg, geoParams: geo, options, tree: compiled });
		const t0 = wallMs(cfg.startDate, cfg.startTime);
		const t1 = wallMs(cfg.endDate, cfg.endTime);
		const mismatches = [];
		let prevEnd = -Infinity;
		res.intervals.forEach((r)=>{
			if(!(r.endMs > r.startMs)){ mismatches.push(`空行/倒挂 ${r.start}`); }
			if(!(r.startMs >= prevEnd)){ mismatches.push(`重叠/乱序 ${r.start}`); }
			if(r.startMs < t0 || r.endMs > t1){ mismatches.push(`越窗 ${r.start}`); }
			if((r.startMs - t0) % MIN !== 0 || (r.endMs - t0) % MIN !== 0){ mismatches.push(`非分钟对齐 ${r.start}`); }
			if(r.durationMin !== Math.round((r.endMs - r.startMs) / MIN)){ mismatches.push(`时长不自洽 ${r.start}`); }
			prevEnd = r.endMs;
		});
		// 恒等:逐步长真值 vs 区间覆盖(窗口半开 [t0,t1))
		for(let ms = t0; ms < t1; ms += stepMs){
			const pass = passAt(ms, compiled, options);
			const cov = covered(res.intervals, ms);
			if(pass !== cov){
				mismatches.push(`${msWall(ms).date} ${msWall(ms).time} 真值=${pass} 覆盖=${cov}`);
			}
		}
		if(!(opts && opts.skipProbes)){
			res.intervals.forEach((r)=>{
				if(!passAt(r.startMs, compiled, options)){ mismatches.push(`行起点非真 ${r.start}`); }
				if(!passAt(Math.max(r.startMs, r.endMs - MIN), compiled, options)){ mismatches.push(`行终点前一分钟非真 ${r.end}`); }
				const before = r.startMs - MIN;
				if(before >= t0 && !covered(res.intervals, before) && passAt(before, compiled, options)){
					mismatches.push(`行起点外一分钟漏收 ${r.start}`);
				}
				const after = r.endMs;
				if(after < t1 && !covered(res.intervals, after) && passAt(after, compiled, options)){
					mismatches.push(`行终点外一分钟漏收 ${r.end}`);
				}
				// 行内同盘探针:行中点+黄金分割点的 plateKey 必须与行首同(欠分裂显影)。
				// [十一轮] mask 与引擎同源同树计算——掩码家探针比掩码 key;行内点 pass 必真
				// (pass 边界由引擎分钟级分解保证;此探针网「时辰中段翻 pass 而采样漏」缺口)。
				if(plateKeyOf && r.endMs - r.startMs > 2 * MIN){
					const headPan = cachedPanAt(r.startMs, options);
					if(headPan){
						let mask = null;
						if(typeof keyMaskOf === 'function'){
							try{ mask = keyMaskOf(compiled) || null; }catch(e){ mask = null; }
						}
						const headKey = plateKeyOf(headPan, mask);
						[0.5, 0.618].forEach((f)=>{
							const ms = r.startMs + Math.floor(((r.endMs - r.startMs) * f) / MIN) * MIN;
							const pan = cachedPanAt(ms, options);
							if(pan && plateKeyOf(pan, mask) !== headKey){
								mismatches.push(`行内换盘未分行 ${r.start}~${r.end} @${msWall(ms).time}`);
							}
							if(pan && !passAt(ms, compiled, options)){
								mismatches.push(`行内点判定为否 ${r.start}~${r.end} @${msWall(ms).time}`);
							}
						});
					}
				}
			});
		}
		matrix.push({ id, hits: res.intervals.length, truncated: !!res.truncated });
		expect({ id, mismatches }).toEqual({ id, mismatches: [] });
		return res;
	}

	function printSummary(){
		const byPrefix = {};
		let zero = 0;
		let skipped = 0;
		matrix.forEach((row)=>{
			const prefix = row.id.split('·')[0];
			byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
			if(row.hits === 0){ zero += 1; }
			if(row.hits === -1){ skipped += 1; }
		});
		// eslint-disable-next-line no-console
		console.log(`[${name} 压测矩阵] 共 ${matrix.length} 行;零命中 ${zero} 行(0 命中亦须真值全假,已恒等);validate 跳过 ${skipped};分组:${JSON.stringify(byPrefix)}`);
	}

	// 全类型全取值行生成:遍历注册表每类;select/multiselect 字段逐 option 值(multiselect 单选形),
	// 其余字段用 defaults——「每个选项至少以判定身份跑过一次恒等」的机械保证。
	function enumerateTypeValueCases(conditionTypes, newLeaf, newGroup, limitPerField){
		const cases = [];
		Object.keys(conditionTypes).forEach((type)=>{
			const spec = conditionTypes[type];
			const fields = spec.fields || [];
			const selectFields = fields.filter((f)=>(f.kind === 'select' || f.kind === 'multiselect') && Array.isArray(f.options) && f.options.length);
			if(!selectFields.length){
				cases.push({ id: `${type}·defaults`, type, params: {} });
				return;
			}
			selectFields.forEach((f)=>{
				const vals = limitPerField ? f.options.slice(0, limitPerField) : f.options;
				vals.forEach((o)=>{
					const v = o && o.value !== undefined ? o.value : o;
					cases.push({
						id: `${type}·${f.key}=${JSON.stringify(v)}`,
						type,
						params: { [f.key]: f.kind === 'multiselect' ? [v] : v },
					});
				});
			});
		});
		return cases.map((c)=>{
			const leaf = newLeaf(c.type);
			leaf.params = { ...leaf.params, ...c.params };
			return { ...c, root: { ...newGroup('all'), children: [leaf] } };
		}).filter((c)=>{
			// validate 预检:单字段盲改可能撞该类 validate(如「两柱须不同」「至少选一项」)——
			// 非法组合不是引擎判定面,跳过并记录(每类至少一个合法值仍被其它字段行覆盖)。
			try{
				compileTree(c.root);
				return true;
			}catch(e){
				matrix.push({ id: `${c.id}·SKIP(${(e && e.message || '').slice(0, 24)})`, hits: -1, truncated: false });
				return false;
			}
		});
	}

	return { scanAndSweep, printSummary, wallMs, msWall, matrix, enumerateTypeValueCases, passAt, cachedPanAt };
}
