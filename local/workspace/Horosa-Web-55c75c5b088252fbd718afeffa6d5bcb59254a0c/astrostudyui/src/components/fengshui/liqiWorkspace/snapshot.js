// AI 快照正文与流派中文名
// 从 LiqiWorkspace.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { implOf } from '../liqi/registry';
import { NUM_GUA, FROM_OPTS } from './options';

// AI 快照文本（各派）。
// 🔴 段头【风水·派名】在此单点统一冠：registry 派只回正文行（自带段头会产双段头、被导出段过滤器切坏）。
export function buildSnapshot(school, r) {   // 具名导出供快照单测(页面调用不变)
	const L = [`【风水·${SCHOOL_CN[school] || school}】`];
	const impl = implOf(school);
	if (impl) { return L.concat(impl.snapshotLines(r)).join('\n'); }
	if (school === 'xuankong') {
		L.push(`坐${r.zuoShan}向${r.xiangShan} ${r.yun}运 · ${r.method}${r.jian ? `(${r.tiVariant})` : ''} · 格局：${r.ge}`);
		L.push(`取用：门派${r.school ? r.school.name : '—'} · 替星${r.tiVariant} · 兼向度界出中${r.jianBoundary}° · 五黄${r.wuHuangSplit === 'liangyuan' ? '两元八运' : '下卦运'}`
			+ (r.wuHuang ? ` · ${r.wuHuang.text}` : ''));
		if (r.jianInfo) { L.push(`兼向：${r.jianInfo.mode}`); }
		L.push(`零正：正神${r.zhengShen.name}/零神${r.lingShen.name} · ${r.yinYangZhai === 'yin' ? '阴宅' : '阳宅'}`);
		if (r.gate && r.gate.available && r.gate.zheng) { L.push(`城门：正城门${r.gate.zheng.name}${r.gate.fu ? `、副${r.gate.fu.name}` : ''}`); }
		if (r.flags.length) { L.push(`结构：${r.flags.map((f)=>`${f.label}${f.nature === 'mild' ? '(力缓)' : ''}`).join('、')}`); }
		if (r.yearHui && r.yearHui.length) { L.push(`流年会断：${r.yearHui.map((h)=>h.warn).join('；')}`); }
		// 流月飞星与流月会断:面板「流月飞星」卡有、快照曾恒缺(monthHui 引擎已算、无人用)。
		if (r.monthPan) {
			const wuG = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((g)=>r.monthPan[g] === 5);
			const wuName = wuG ? ((r.palaces.find((p)=>p.gong === wuG) || {}).name || '') : '';
			L.push(`流月飞星：月入中${r.monthPan[5]} · 向首流月星${r.monthPan[r.gXiang]}${wuName ? ` · 五黄到${wuName}（忌动）` : ''}`);
		}
		if (r.monthHui && r.monthHui.length) { L.push(`流月会断：${r.monthHui.map((h)=>h.warn).join('；')}`); }
		L.push('双星：' + r.palaces.map((p)=>`${p.name}${p.shan}·${p.xiang}(${p.combo.note})`).join('；'));
		if (r.shousha) {
			L.push(`收山出煞（三吉${r.shousha.sanJi.join('·')}）：${r.shousha.verdict.text}`);
			if (r.shousha.rows && r.shousha.rows.length) L.push('逐宫：' + r.shousha.rows.map((x)=>`${x.gua}${x.env === 'shan' ? '山' : (x.env === 'gao' ? '高' : (x.env === 'shui' ? '水' : '空'))}${x.badN === 0 ? '合' : (x.okN === 0 ? '违' : '半')}`).join(' '));
		}
	} else if (school === 'sanhe') {
		L.push(`水口${r.shuiKou}→${r.ju}` + (r.xiangFa ? ` · 立${r.xiangFa.type}(${r.xiangFa.shuangshan || ''})` : ''));
		if (r.huangquan && r.huangquan.baYao) { L.push(`黄泉：${r.huangquan.baYao.text}`); }
		if (r.shuiFa13Cur) { L.push(`十三水法（${r.shuiFa13.ju}）第${r.shuiFa13Cur.no}条·${r.shuiFa13Cur.name}：${r.shuiFa13Cur.text}`); }
		if (r.geLong) { L.push(`格龙：${r.geLong.text}`); }
		if (r.bosha) {
			const s = r.bosha.sands.filter((x)=>x.wuGe);
			const vl = r.bosha.boshaVariant === 'laigong' ? `赖公人盘中针·我＝${r.bosha.myShan}山${r.bosha.myWuxing}` : `${r.bosha.myFrom}·我＝${r.bosha.myWuxing}`;
			if (s.length) { L.push(`拨砂（${vl}）：` + s.map((x)=>`${x.gua}${x.wuGe.ge}`).join('、')); }
		}
		if (r.xianfa) { L.push(`坐度线法：穿山${r.xianfa.chuanshan.ganzhi}/透地${r.xianfa.toudi.ganzhi}/分金${r.xianfa.fenjin.positional}`); }
	} else if (school === 'zibai') {
		L.push(`${r.year}年入中${r.yearCenterStar}`);
		L.push(r.yearPalaces.map((p)=>`${p.name}${p.starName}${p.jx === 'good' ? '吉' : '凶'}`).join(' '));
		if (r.monthPalaces) { L.push(`${r.month}月入中${r.monthCenterStar}`); }
		if (r.dayInfo) { L.push(`日紫白${r.dayInfo.dayGanZhi}入中${r.dayInfo.center}(${r.dayInfo.yang ? '阳遁' : '阴遁'}${r.dayInfo.yuanName || ''})`); }
		if (r.hourInfo) { L.push(`时紫白${r.hourInfo.shiZhi}时入中${r.hourInfo.center}`); }
	} else if (school === 'bazhai') {
		L.push(`坐${r.zuoGua}${r.zhaiGroup}` + (r.mingGua ? ` · 命卦${NUM_GUA[r.mingGua] || r.mingGua}${r.mingGroup}${r.match ? '·' + r.match.text : ''}` : ''));
		if (r.faMai && r.faMai !== 'zuoshan') { L.push(`法脉：${r.faMai === 'menshang' ? '门上起伏位' : '三元阳宅'}（伏位卦＝${r.fuweiGua}）${r.lunMing === false ? ' · 不论命卦' : ''}`); }
		if (r.sanyuan) { L.push(`三元阳宅：${r.sanyuan.verdict.text} · ${r.sanyuan.fanZhuan}`); }
		// 宅类(静/动/变/化)四档只改 zhaiTypeInfo 标注,此前快照无;门/主/灶只设一两卦时面板现算游星吉凶,快照只在三卦全设时写三要。
		// 宅类四档只改分类标注,八方游星与判定仍按静宅单盘 —— 快照如实写
		if (r.zhaiTypeInfo && r.zhaiTypeInfo.name) { L.push(`宅类：${r.zhaiTypeInfo.name}·${r.zhaiTypeInfo.range || ''}（仅分类标注；八方游星仍按静宅单盘）`); }   // 名·进数 + 标注
		if (!r.mingGua) { L.push('命主：未录（命卦 / 宅命相配从略）'); }   // 命主年缺省空 → 无命卦时快照如实写
		if (r.sanYao) { L.push(`三要：门→主${r.sanYao.menMain.name}/主→灶${r.sanYao.mainStove.name}/门→灶${r.sanYao.menStove.name}·${r.sanYao.verdict.text}`); }
		else if (r.inputs && (r.inputs.doorGua || r.inputs.mainGua || r.inputs.stoveGua)) {
			const parts = [['门卦', r.inputs.doorGua], ['主卦', r.inputs.mainGua], ['灶卦', r.inputs.stoveGua]].filter(([, g])=>g).map(([k, g])=>{
				const pal = (r.palaces || []).find((p)=>p.gua === g);
				return pal ? `${k}${g}（${pal.dir}）${pal.name}${pal.jx === 'good' ? '吉' : (pal.jx === 'bad' ? '凶' : '')}` : `${k}${g}`;
			});
			const miss = [['门卦', r.inputs.doorGua], ['主卦', r.inputs.mainGua], ['灶卦', r.inputs.stoveGua]].filter(([, g])=>!g).map(([k])=>k);
			L.push(`三要（未齐，尚缺${miss.join('、')}）：${parts.join('；')}`);
		}
		// 以命时八方游星按命卦起伏位:标明基准,否则读者会把命卦游星当成宅卦游星。
		const yxBase = (r.mode === 'ming' && r.mingGua) ? `（以命卦${NUM_GUA[r.mingGua] || r.mingGua}起伏位）` : '';
		L.push(`游星${yxBase}：` + r.palaces.map((p)=>`${p.dir}${p.name}`).join(' '));
	} else if (school === 'qiankun') {
		L.push(`坐${r.zuoGua} · 先天位${r.xianTian}(主丁)/后天位${r.houTian}(主财)/案劫${r.anJie}` + (r.heJu ? ' · 合局' : ''));
		L.push('九水位：' + r.positions.map((p)=>`${p.name}${p.result}`).join('；'));
	} else if (school === 'jinsuo') {
		L.push(`得位${r.deCount}/8 ${r.score}分`);
		L.push(r.palaces.map((p)=>`${p.gua}${p.deWei ? '得位' : (p.actual === 'flat' ? '平' : '失位')}`).join(' '));
		if (r.duanjue) {
			L.push('断诀：' + r.duanjue.rows.map((x)=>`${x.shan}${x.actual === 'water' ? '水' : '砂'}—${x.text}`).join('；'));
			if (r.duanjue.gongQuan.length) { L.push('宫全：' + r.duanjue.gongQuan.map((g)=>g.text).join('；')); }
			if (r.duanjue.kuaGong.length) { L.push('跨宫：' + r.duanjue.kuaGong.map((k)=>k.text).join('；')); }
		}
		if (r.mixedGuas && r.mixedGuas.length) { L.push(`三山参差之宫（作未定）：${r.mixedGuas.join('、')}`); }
		if (r.palaces.some((p)=>p.yingqi)) {
			L.push(`应期（${r.yun}运·${r.year}年）：` + r.palaces.map((p)=>`${p.gua}${p.yingqi.text}`).join('；'));
		}
	} else if (school === 'fuxing') {
		L.push(`辅星${(FROM_OPTS.find((o)=>o.value === r.qiFrom) || {}).label || '向卦'}起${r.startGua || r.benGua}${r.heFa ? '·合法' : ''}`);
		L.push(r.palaces.map((p)=>`${p.gua}${p.youxing}${p.water ? (p.water === 'come' ? '来' : '去') : ''}`).join(' '));
	} else if (school === 'jingyin') {
		L.push(`龙${r.items[0].shan}${r.items[0].yy || ''}/向${r.items[1].shan}${r.items[1].yy || ''}/水${r.items[2].shan}${r.items[2].yy || ''} · ${r.verdict.text}`);
		if (r.liuxiu) { L.push(`六秀：${r.liuxiu.list.join('、')}`); }
	} else if (school === 'dagua') {
		L.push(`向${r.xiang.name}(卦运${r.xiang.yun})/坐${r.zuo.name}(卦运${r.zuo.yun}) · 正神${r.zheng.yun}零神${r.ling.yun}`);
		if (r.degInfo) { L.push(`向首度数 ${r.deg}° → ${r.degInfo.gua} ${r.degInfo.yao}爻（${r.degInfo.sector}宫·入卦 ${r.degInfo.degInGua}°）`); }
		L.push('卦气：' + r.flags.map((f)=>f.label).join('、'));
		if (r.deep) {
			const d = r.deep;
			if (d.eryuan.cur) { L.push(`二元八运：${d.eryuan.cur.gua}${d.eryuan.cur.yun}运 ${d.eryuan.cur.from}–${d.eryuan.cur.to}（${d.eryuan.cur.years}年·${d.eryuan.cur.yuan}）`); }
			L.push(`正神${d.eryuan.zhengLing.zheng.join('·')}／零神${d.eryuan.zhengLing.ling.join('·')}`);
			const R = { xiang: '向', shan: '山', long: '龙', shui: '水' };
			L.push('四数：' + ['xiang', 'shan', 'long', 'shui'].map((k)=>d.siShu.after[k]).filter(Boolean)
				.map((v)=>`${v.name}(气${v.xianTianQi}/位${v.xianTianWei}/运${v.xingYun}/宫${v.houTianWei})`).join('；'));
			if (d.chouYao) { L.push(`些子法：抽第${d.chouYao}爻 · ${d.verdict.text}`); }
			d.jiaoTong.forEach((p)=>{
				L.push(`交通${p.label}：五行${p.wuxing ? p.wuxing.ge : '—'}/卦运${p.guayun ? p.guayun.ge : '—'}/亲缘${p.qinyuan ? p.qinyuan.ge : '—'}/打劫${p.dajie ? p.dajie.ge : '—'}/后天${p.houtian ? p.houtian.name : '—'}`);
			});
			void R;
		}
	} else if (school === 'xingshi') {
		L.push(`龙${r.long.score}穴${r.xue.score}砂${r.sha.score}水${r.shui.score}向${r.xiang.score}`
			+ (r.scoreMode === 'nine' ? `明堂${r.mingtang.score}龙虎${r.longhu.score}水口${r.shuikou.score}太极${r.taiji.score}` : '')
			+ ` · 总${r.total}·${r.grade.text}`);
		L.push(`形体：九星${r.long.star ? r.long.star.name : '—'}/穴形${r.xue.type || '—'}/定穴${r.xue.dingXue || '—'}/倒杖${r.xue.daoZhang || '—'}/水城${r.shui.cheng ? r.shui.cheng.name : '—'}`);
		if (r.scoreMode === 'nine') {
			L.push(`九纲：明堂${r.mingtang.ji ? r.mingtang.ji.name : '—'}${r.mingtang.xiong ? `/${r.mingtang.xiong.name}` : ''}`
				+ ` · 龙虎${r.longhu.duan ? r.longhu.duan.xing : '—'}`
				+ ` · 水口${r.shuikou.sha ? r.shuikou.sha.name : '—'}${r.shuikou.guan.length ? `(${r.shuikou.guan.join('/')})` : ''}`
				+ ` · 证穴${r.taiji.zhengMain}主${r.taiji.zhengSpec ? `+${r.taiji.zhengSpec}特` : ''}`);
			// 定穴十三法/结穴局势/怪穴八种此前只进分数,快照不列名(面板列名)。
			const xz = [r.taiji.dingXue ? `定穴十三法：${r.taiji.dingXue.name}` : '', r.taiji.jieJu ? `结穴局势：${r.taiji.jieJu}` : '', r.taiji.guaiXue ? `怪穴：${r.taiji.guaiXue.name}` : ''].filter(Boolean);
			if (xz.length) { L.push('穴证名目：' + xz.join('；')); }
			if (r.modulation.length) { L.push('权重调制：' + r.modulation.map((m)=>m.text).join('；')); }
			if (r.taiji.veto.length) { L.push('否决：' + r.taiji.veto.join('；')); }
		}
	} else if (school === 'zeri') {
		const yg = r.yg;
		L.push(`${yg.yearGanZhi}年神：太岁${yg.taisui.dir}/岁破${yg.suipo.dir}/三煞${yg.sansha.list.map((s)=>s.zhi).join('')}/五黄${yg.wuHuang.dir || '—'} · 忌动${yg.jiDongDirs.join('、')}`);
		// 坐山·本年可动否(不依赖月日;面板卡有、快照曾缺)
		if (r.zuoShanCheck) { L.push(`坐山${r.zuoShan}（${r.zuoShanCheck.gongName}）本年：${r.zuoShanCheck.text}`); }
		if (r.course) { L.push(`日课：建除${r.course.jianChu.name}/${r.course.huangHei.dao}/${r.course.xiu.name}宿`); }
		if (r.zaoming) {
			const z = r.zaoming;
			L.push(`造命四纲（坐${z.zuoShan}）：已评 ${z.gangDone.join('·')}`
				+ (z.laiLong ? ` · 来龙${z.laiLong.shan}(${z.laiLong.ju})` : '')
				+ (z.zhuMing ? ` · 主命${z.zhuMing.year}${z.zhuMing.isMale ? '男' : '女'}${z.zhuMing.gua}命(${z.zhuMing.wuxing})` : ''));
			['补龙', '扶山', '相主', '避煞'].forEach((g)=>{
				const list = z.items.filter((it)=>it.gang === g);
				if (list.length) { L.push(`　${g}：${list.map((it)=>`${it.pillar}柱${it.effect}`).join('；')}`); }
			});
			L.push(`课评：${z.grade.text}(${z.score})`);
			if (z.deep) {
				const d = z.deep;
				if (d.yongShi) { L.push(`用事：${d.yongShi.cls}·${d.yongShi.name}${d.yongShi.rank === 1 ? '（最重之事）' : ''}`); }
				if (d.sanBu.ganZhi) {
					const gz = d.sanBu.ganZhi;
					L.push(`干支搭配（${gz.pillars.join(' ')}）：${gz.verdict.text}`
						+ (gz.hanNuan ? `；寒暖：${gz.hanNuan.need}${gz.hanNuan.ok ? '已具' : '未见'}` : ''));
				}
				if (d.zibai.combo) { L.push(`紫白组合 ${d.zibai.combo.k}：${d.zibai.combo.text}`); }
				if (d.zibai.chongFu) { L.push(`紫白冲伏：${d.zibai.chongFu.text}`); }
				if (d.zibai.huaSha) { L.push(`动象化煞：${d.zibai.huaSha.why}`); }
				if (d.douShou) {
					L.push(`斗首（坐${d.douShou.zuoShan}·${d.douShou.myWuxing}）：`
						+ d.douShou.rows.map((x)=>`${x.pillar}${x.gan}→${x.liuQin || '—'}`).join(' ')
						+ '；' + d.douShou.checks.map((c)=>`${c.name}${c.n}位`).join('/'));
				}
			}
		}
	} else if (school === 'liufa') {
		L.push(`${r.yun}运 坐${r.zuoShan} 向${r.xiangShan}${r.yunRange ? `（${r.yunRange[0]}–${r.yunRange[1]}）` : ''}`);
		r.items.forEach((it)=>{ L.push(`${it.name}：${it.verdict}${it.detail ? ` —— ${it.detail}` : ''}`); });
		L.push(`综断：${r.summary.text}（合${r.goodN}·违${r.badN}）`);
		L.push(r.note);
	} else if (school === 'mingli') {
		const m = r.ming; const mt = r.match;
		L.push(`命主 ${m.year}年${m.isMale ? '男' : '女'} · ${m.gua}命（${m.group}·${m.wuxing}）· ${m.yiJu}`);
		L.push(`喜忌：${m.xiYong}`);
		L.push(`宅：坐${r.zhai.zuoGua}（${r.zhai.dir}·${r.zhai.group}·${r.zhai.wuxing}）`);
		L.push(`相配：${mt.groupText}；宅对命${mt.star ? `${mt.star.name}(${mt.star.rank})` : '—'}；五行${mt.wuxing ? mt.wuxing.label : '—'} → ${mt.verdict.text}`);
		L.push(`个人吉方：${r.jiFang.map((f)=>`${f.dir}${f.star}`).join('、')}`);
		L.push(`个人凶方：${r.xiongFang.map((f)=>`${f.dir}${f.star}`).join('、')}`);
		L.push(r.note);
	} else if (school === 'luopan') {
		if (r.panTypeMeta) {
			L.push(`盘式：${r.panTypeMeta.name}——${r.panTypeMeta.feature}`);
			// 盘式口径注 / 各派采参 此前只在右栏「盘式」卡显示,不进快照。
			if (r.panTypeMeta.note) { L.push(`盘式口径：${r.panTypeMeta.note}`); }
			if (r.droppedLayers.length) { L.push(`本盘式无此层（已移除）：${r.droppedLayers.join('、')}`); }
			if (r.paiNeedle) { L.push(`各派采参：${Object.keys(r.paiNeedle).map((k)=>`${SCHOOL_CN[k] || k}：${r.paiNeedle[k].label}`).join('；')}`); }
		}
		// 分金 / 穿山择优:结论行之外逐候选列出(干支·度界·可用与否·缘由·位置性),与右栏卡同一 rows。
		if (r.fenjinPick) {
			L.push(`分金择优（坐${r.fenjinPick.shan}）：${r.fenjinPick.verdict.text}`);
			(r.fenjinPick.rows || []).forEach((x)=>{ L.push(`　${x.usable ? '✓' : '✗'} ${x.ganzhi}（${x.deg0.toFixed(2)}°–${x.deg1.toFixed(2)}°）：${x.why}；位置性：${x.positional}`); });
			if (r.fenjinPick.best) { L.push(`　首选：${r.fenjinPick.best.ganzhi}（中线 ${r.fenjinPick.best.degMid.toFixed(2)}°，距山心最近）`); }
		}
		if (r.chuanshanPick) {
			L.push(`穿山择优：${r.chuanshanPick.verdict.text}`);
			(r.chuanshanPick.rows || []).forEach((x)=>{ L.push(`　${x.usable ? '✓' : '✗'} ${x.ganzhi}（${x.deg0.toFixed(2)}°–${x.deg1.toFixed(2)}°）：${x.why}；位置性：${x.positional}`); });
		}
		if (r.jian) { L.push(`兼线校验：坐${r.jian.zuoShan}兼${r.jian.jianShan} ${r.jian.jianDeg}° —— ${r.jian.verdict.text}（${r.jian.items.map((x)=>`${x.name}${x.ok ? '合' : '违'}`).join('/')}）`); }
		if (r.magnetic) { L.push(`磁偏角：${r.magnetic.verdict.text}`); }
		if (r.panxiang && r.panxiang.verdict) { L.push(`判向：${r.panxiang.verdict.text}`); }
		else if (r.panxiang && r.panxiang.isDanyuan) {
			L.push(`判向（单元住宅）：${r.panxiang.pick.name}`);
			// 内外局权衡等定向步骤此前只在步骤文字,快照只写定向法名。
			(r.panxiang.steps || []).forEach((st)=>{ if (st && st.name && st.text) { L.push(`　${st.name}：${st.text}`); } });
		}
		L.push(`天星八贵：${r.tianxing.baGui.join('、')}`);
		L.push(`坐${r.zuoShan} 向${r.xiangShan} · 度数 ${r.deg.toFixed(2)}°`);
		L.push('三针：' + r.needles.map((n)=>`${n.name}${n.offset ? `(${n.offset > 0 ? '+' : ''}${n.offset}°)` : ''}＝${n.shan}山`).join('；'));
		L.push(`线法：穿山${r.chuanshan.ganzhi}(${r.chuanshan.positional})/透地${r.toudi.ganzhi}${r.toudi.nayin ? `·${r.toudi.nayin.name}` : ''}${r.toudi.kong ? '·空亡' : ''}/分金${r.fenjin.ganzhi}(${r.fenjin.positional})`);
		L.push(`卦爻：${r.gua64.gua} ${r.gua64.yao}爻（${r.gua64.sector}宫·入卦${r.gua64.degInGua}°）`);
		if (r.xiu) { L.push(`二十八宿：${r.xiu.name}宿（${r.xiu.xiang}）—— 等分示意，非周天盈缩实度`); }
		L.push(`卦宫：${r.gongName || '—'} · ${r.yuanlong || '—'}元${r.yinyang || ''} · 净${r.jingYinYang || '—'}`);
		L.push('三针分工：正针格龙立向、中针消砂、缝针纳水。');
	}
	return L.join('\n');
}

export const SCHOOL_CN = {
	naqi: '纳气盘', bagua: '八卦阳宅', bazhai: '八宅大游年', xuankong: '玄空飞星', sanhe: '三合水法',
	huasha: '改造化煞',
	zhaiduan: '阳宅判断',
	jinsuo: '金锁玉关', qiankun: '乾坤国宝', zibai: '紫白飞星',
	fuxing: '辅星水法', jingyin: '净阴净阳', dagua: '玄空大卦', xingshi: '形势峦头', zeri: '择日选择',
	liufa: '玄空六法', mingli: '命理派', luopan: '综合罗经', daxuankong: '大玄空', shuilong: '水龙平洋',
};
