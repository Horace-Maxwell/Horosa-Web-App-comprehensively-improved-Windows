// 策天页 · 右栏(条文、古籍、各页签段落、策天资料与设置)、底部快捷栏与技法导轨
// 从 KinAstroMain.js 按职责拆出的 KinAstroMain 方法:this 仍是 KinAstroMain 实例,门面里 mixinMethods(KinAstroMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React, { Suspense } from 'react';
import { Collapse } from 'antd';
import CanPingMain from '../../shusuan/CanPingMain';
import HeLuoMain from '../../shusuan/HeLuoMain';
import YiZhangJingMain from '../../yizhangjing/YiZhangJingMain';
import YanQinBranchPanel from '../../yanqin/YanQinBranchPanel';
import renderCetianSectionList from '../CetianSections';
import XQIcon from '../../xq-icons';
import { XQTabs as Tabs, XQSwitch as Switch, XQSpin } from '../../xq-ui';
import { INTERNAL_SECTION_TITLES, CETIAN_TAB_SECTIONS } from './config';
import { fmtValue, buildSnapshotText, sectionByTitle } from './snapshot';
import { formatGeoRowValue } from './ziweiChart';
import { cetianDisplayToggles, YZJ_AUX_TABS } from './settings';
import { ZhengChuanMain } from './lazyPanels';
import { FreezeSubTab } from '../../comp/FreezeInactive';
const { TabPane } = Tabs;

export const rightPanelMethods = {
	renderRows(sections){
		const list = sections || [];
		if(!list.length){
			return <div className="horosa-huangji-empty">暂无数据</div>;
		}
		return list.map((section)=>(
			<div className="horosa-huangji-info-card" key={section.title}>
				<div className="horosa-huangji-info-heading">{section.title}</div>
				{(section.rows || []).map((item, idx)=>(
					<div className="horosa-huangji-info-row" key={`${section.title}_${item.label}_${idx}`}>
						<span>{item.label}</span>
						<strong>{fmtValue(formatGeoRowValue(item.label, item.value))}</strong>
					</div>
				))}
			</div>
		));
	},

	renderClassics(){
		const classics = this.state.pan && this.state.pan.classics ? this.state.pan.classics : null;
		if(!classics || !classics.sections || !classics.sections.length){
			return <div className="horosa-huangji-empty">暂无来源说明</div>;
		}
		return (
			<div className="horosa-huangji-classics">
				{(classics.meta || []).map((item)=>(
					<div className="horosa-huangji-info-card" key={item.key}>
						<div className="horosa-huangji-info-heading">{item.title}</div>
						<div className="horosa-huangji-info-row"><span>作者</span><strong>{item.author}</strong></div>
						<div className="horosa-huangji-info-row"><span>说明</span><strong>{item.description}</strong></div>
					</div>
				))}
				<div className="horosa-huangji-classic-list">
					{classics.sections.map((section)=>(
						<div className="horosa-huangji-classic-section" key={section.title}>
							<strong>{section.title}</strong>
							<p>{section.content}</p>
						</div>
					))}
				</div>
			</div>
		);
	},

	getTabSections(tabKey){
		const sections = this.state.pan ? (this.state.pan.sections || []).filter((section)=>!INTERNAL_SECTION_TITLES.has(section.title)) : [];
		if(tabKey === 'overview'){
			return sections.slice(0, 4);
		}
		if(tabKey === 'pillars'){
			return sectionByTitle(sections, ['四柱']);
		}
		if(tabKey === 'digits'){
			return sectionByTitle(sections, ['四位起数', '河洛纳音', '完整结构', '64钥匙']);
		}
		if(tabKey === 'core'){
			// 六亲佐证=铁板左栏六亲四项的考刻资料回显(扣入法据父母生年调刻 / 分,与命身刻分同看);曾无页签收,填了屏上不见
			return sectionByTitle(sections, ['命身刻分', '神数号码', '算盘定部', '计算摘要', '六亲佐证']);
		}
		if(tabKey === 'twoGan'){
			return sectionByTitle(sections, ['两头钳']);
		}
		if(tabKey === 'fate'){
			return sectionByTitle(sections, ['命格']);
		}
		if(tabKey === 'yearHour'){
			return sectionByTitle(sections, ['起盘', '年时', '条文索引']);
		}
		if(tabKey === 'queries'){
			return sectionByTitle(sections, ['完整条文']);
		}
		if(tabKey === 'search'){
			return sectionByTitle(sections, ['条文检索', '代码查询', '批量代码查询', '关键词检索', '多标签检索', '宿名检索', '时辰检索']);
		}
		if(tabKey === 'palaceText'){
			return sectionByTitle(sections, ['宫部条文']);
		}
		if(tabKey === 'queryText'){
			return sectionByTitle(sections, ['条文查询']);
		}
		if(tabKey === 'family'){
			return sectionByTitle(sections, ['家亲']);
		}
		if(tabKey === 'fortune'){
			return sectionByTitle(sections, ['财官性情']);
		}
		if(tabKey === 'text'){
			return sectionByTitle(sections, ['条文', '64钥匙', '元会运世']);
		}
		if(tabKey === 'palaces'){
			// 紫微安星(扣入法各星落支)名不以「宫」收尾,曾被下方按名尾收宫的规则漏掉
			return sectionByTitle(sections, ['三宫', '十二宫', '十二宫条文', '紫微安星'].concat((sections || []).map((s)=>s.title).filter((title)=>/[宫宮]$/.test(title))));
		}
		if(tabKey === 'verses'){
			return sectionByTitle(sections, ['条文', '十二宫条文', '条文库', '判断', '六段断语']);
		}
		if(tabKey === 'dayun'){
			return sectionByTitle(sections, ['大运']);
		}
		if(tabKey === 'password'){
			return sectionByTitle(sections, ['密码']);
		}
		if(tabKey === 'divine'){
			return sectionByTitle(sections, ['星图推演']);
		}
		if(tabKey === 'codes'){
			return sectionByTitle(sections, ['代码来源']);
		}
		if(tabKey === 'analysis'){
			return sectionByTitle(sections, ['结构解析']);
		}
		if(tabKey === 'candidates'){
			return sectionByTitle(sections, ['候选条文']);
		}
		if(tabKey === 'lookup'){
			return sectionByTitle(sections, ['代码查询', '批量代码查询']);
		}
		if(tabKey === 'stars'){
			// 后端「三星」已改名「三星·元辰」(加元辰禽),旧名留作兼容
			return sectionByTitle(sections, ['三星', '三星·元辰', '衍生星', '二十八宿禽']);
		}
		if(tabKey === 'xqYunxian'){
			// 演禽系统A禄命:大限 / 流年小限 / 孤辰寡宿(神煞·待校)——后端新增后页签映射曾没跟上,只进 AI 快照、屏上不见
			return sectionByTitle(sections, ['大限', '流年小限', '神煞·待校']);
		}
		if(tabKey === 'swallow'){
			return sectionByTitle(sections, ['吞啖合战', '情性与格局']);
		}
		if(tabKey === 'flying'){
			return sectionByTitle(sections, ['飞星']);
		}
		if(tabKey === 'patterns'){
			return sectionByTitle(sections, ['格局']);
		}
		if(tabKey === 'liunian' || tabKey === 'yunxian' || tabKey === 'duanjue'){
			return sectionByTitle(sections, CETIAN_TAB_SECTIONS[tabKey]);
		}
		if(tabKey === 'ziliao'){
			// 典籍资料页:含 INTERNAL 段(星曜别名/属性/正曜副曜/三合组),绕过头部过滤直读原始 sections。
			const raw = this.state.pan ? (this.state.pan.sections || []) : [];
			return sectionByTitle(raw, CETIAN_TAB_SECTIONS.ziliao);
		}
		if(tabKey === 'full'){
			return sections;
		}
		return sections.slice(0, 4);
	},

	renderCetianZiliao(){
		// 典籍页 = 资料段(含 INTERNAL 星曜别名等) + 来源依据(classics) + 移语本典籍全文(惰性)。
		const sections = this.getTabSections('ziliao');
		const classics = this.state.pan && this.state.pan.classics;
		const classicsSections = Array.isArray(classics) ? classics : [];
		const texts = this.state.cetianTexts;
		const textKeys = texts ? Object.keys(texts) : [];
		return (
			<div className="horosa-huangji-section-list">
				{renderCetianSectionList(sections, this.state.pan, (secs)=>this.renderRows(secs))}
				{classicsSections.length ? this.renderRows(classicsSections) : null}
				<div className="horosa-cetian-texts-block">
					<div className="horosa-info-card-title">典籍全文（《正命二十八宿移语》）</div>
					{texts ? (
						<Collapse className="horosa-cetian-texts-collapse" bordered={false}>
							{textKeys.map((key)=>{
								const doc = texts[key] || {};
								return (
									<Collapse.Panel header={doc.title || key} key={key}>
										{(doc.sections || []).map((sec, idx)=>(
											<div className="horosa-cetian-text-section" key={`${key}_${idx}`}>
												{sec.subtitle ? <div className="horosa-cetian-text-subtitle">{sec.subtitle}</div> : null}
												<pre className="horosa-cetian-text-body">{sec.body}</pre>
											</div>
										))}
									</Collapse.Panel>
								);
							})}
						</Collapse>
					) : (
						<button
							type="button"
							className="horosa-bottom-quick-button horosa-cetian-texts-load"
							onClick={this.loadCetianTexts}
							disabled={!!this.state.cetianTextsLoading}
						>
							{this.state.cetianTextsLoading ? '加载中…' : '加载典籍全文'}
						</button>
					)}
				</div>
			</div>
		);
	},

	renderCetianSettings(){
		// 策天「设置」tab:与左栏同一组显示开关(cetianDisplayToggles,随算法);算法/农历/正曜在左栏选。
		// 切开关 → setState + clickPlot 重新起盘 → 后端按 show_* 过滤段/行 → 右栏即时增删(铁律3)。
		const toggle = ([key, label])=>(
			<label className="horosa-cetian-toggle" key={key}>
				<Switch size="small" checked={!!this.state[key]} onChange={(v)=>this.setUserOpt({ [key]: v ? 1 : 0 }, this.clickPlot)} />
				<span>{label}</span>
			</label>
		);
		return (
			<div className="horosa-cetian-settings-panel">
				<div className="horosa-info-card-title">显示选项</div>
				<div className="horosa-cetian-toggle-list">
					{cetianDisplayToggles(this.state.cetianMethod).map(toggle)}
				</div>
				<div className="horosa-cetian-settings-hint">算法（书法 / 原法）、农历、正曜等在左栏选择；此处与左栏的显示勾选是同一组开关，随所选算法变化。</div>
			</div>
		);
	},

	renderRightPanel(){
		if(this.config.serviceKey === 'canping'){
			return <div className="horosa-huangji-section-list"><CanPingMain slot="aux" fields={this.props.fields} gender={this.state.gender} method={this.state.canpingMethod} opts={this.buildCanpingOpts()} /></div>;
		}
		if(this.config.serviceKey === 'heluo'){
			return <div className="horosa-huangji-section-list"><HeLuoMain slot="aux" fields={this.props.fields} gender={this.state.gender} quHuaGong={this.state.heluoQuHuaGong} opts={this.buildHeluoOpts()} /></div>;
		}
		if(this.config.serviceKey === 'zhengchuan'){
			return <div className="horosa-huangji-section-list">
					<Suspense fallback={<div className="horosa-zhengchuan-loading"><XQSpin size="small" /> 载入中</div>}>
						<ZhengChuanMain slot="aux" fields={this.props.fields} gender={this.state.gender} opts={this.buildZhengChuanOpts()} onOwnHourZhi={this.onZcOwnHourZhi} />
					</Suspense>
				</div>;
		}
		if(this.config.serviceKey === 'yizhangjing'){
			return <div className="horosa-huangji-section-list"><YiZhangJingMain slot="aux" fields={this.props.fields} gender={this.state.gender} opts={this.buildYizhangjingOpts()} activeTab={this.state.yizhangjingTab || 'overview'} onTabChange={this.setYizhangjingTab} /></div>;
		}
		const snapshot = this.snapshotText();
		const visibleTabs = this.visibleTabsOf(snapshot);
		const activeKey = visibleTabs.some((item)=>item.key === this.state.rightPanelTab)
			? this.state.rightPanelTab
			: (visibleTabs[0] ? visibleTabs[0].key : 'overview');
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-huangji-tabs horosa-kinastro-tabs">
				{visibleTabs.map((item)=>(
					<TabPane tab={item.label} key={item.key}>
						{/* horosa_freeze_subtabs_v1:右栏子页签冻结。此前每个 TabPane 的内容都在
						    本方法里【当场求值】(getTabSections 过滤全段 + renderRows 造出全部行,
						    铁板 7 目、南极 7 目、蠢子 7 目一次全造),而用户只看得见一目。
						    改函数式:未激活的目连元素都不创建;已看过的目保持挂载(DOM/滚动位置/
						    展开态全在),只是父组件重渲时不再穿透;切回去时拿本轮最新 children
						    立刻渲一帧 —— 不重新挂载、不重取、不闪烁、零陈旧。 */}
						<FreezeSubTab active={activeKey === item.key}>
							{()=>(
								item.key === 'snapshot' ? (
									<pre className="horosa-huangji-snapshot">{snapshot}</pre>
								) : item.key === 'classics' ? (
									<div className="horosa-huangji-section-list">{this.renderClassics()}</div>
								) : item.key === 'settings' ? (
									<div className="horosa-huangji-section-list">{this.renderCetianSettings()}</div>
								) : item.key === 'ziliao' && this.config.serviceKey === 'cetian' ? (
									this.renderCetianZiliao()
								) : item.key === 'yanfa' ? (
									<div className="horosa-huangji-section-list"><YanQinBranchPanel fields={this.props.fields} gender={this.state.gender} /></div>
								) : item.key === 'framework' ? (
									<div className="horosa-huangji-section-list">{this.renderTiebanFrameworkTab()}</div>
								) : this.config.serviceKey === 'cetian' ? (
									<div className="horosa-huangji-section-list">{renderCetianSectionList(this.getTabSections(item.key), this.state.pan, (secs)=>this.renderRows(secs))}</div>
								) : (
									<div className="horosa-huangji-section-list">{this.renderRows(this.getTabSections(item.key))}</div>
								)
							)}
						</FreezeSubTab>
					</TabPane>
				))}
			</Tabs>
		);
	},

	renderBottomQuickDock(){
		// 与右栏同源(snapshotText/visibleTabsOf 带缓存):此前这里把快照拼接与页签过滤
		// 又整整算了第二遍,同一次重渲白付两倍。
		const snapshot = this.snapshotText();
		const visibleTabs = this.visibleTabsOf(snapshot);
		// 一掌经的右栏页签不在 config.tabs 里(它自己画),快捷栏照它的页签列,和其它技法同一种用法。
		const yzjTabs = this.config.serviceKey === 'yizhangjing'
			? YZJ_AUX_TABS.filter((item)=>item.key !== 'shensha' || this.state.yizhangjingShensha)
			: [];
		const yzjActive = this.state.yizhangjingTab || 'overview';
		const actions = [
			{ label: '起盘', icon: 'quickPrimary', onClick: this.clickPlot },
			...visibleTabs.map((item)=>({
				label: item.label,
				icon: item.key === 'snapshot' ? 'quickAi' : (item.key === 'classics' ? 'book' : 'quickNote'),
				active: this.state.rightPanelTab === item.key,
				onClick: ()=>this.setRightPanelTab(item.key),
			})),
			...yzjTabs.map((item)=>({
				label: item.label,
				icon: item.key === 'lore' || item.key === 'sizhu' ? 'book' : 'quickNote',
				active: yzjActive === item.key || (item.key === 'overview' && yzjActive === 'shensha' && !this.state.yizhangjingShensha),
				onClick: ()=>this.setYizhangjingTab(item.key),
			})),
		];
		return (
			<div className="horosa-bottom-quick-dock horosa-huangji-quick-dock horosa-kinastro-quick-dock">
				<div className="horosa-bottom-quick-title">快捷功能 <XQIcon name="ai" /></div>
				<div className="horosa-bottom-quick-actions horosa-huangji-quick-actions horosa-kinastro-quick-actions">
					{actions.map((item)=>(
						<button
							type="button"
							key={`${item.label}_${item.icon}`}
							className={`horosa-bottom-quick-button horosa-huangji-quick-button${item.active ? ' is-active' : ''}`}
							onClick={item.onClick}
						>
							<span className="horosa-bottom-quick-icon"><XQIcon name={item.icon} /></span>
							<span>{item.label}</span>
						</button>
					))}
				</div>
			</div>
		);
	},

	renderTechniqueRail(){
		const propTechniqueTabs = Array.isArray(this.props.techniqueTabs) ? this.props.techniqueTabs : [];
		if(propTechniqueTabs.length > 1){
			const activeTechnique = this.props.activeTechnique || this.props.technique || this.config.serviceKey;
			return (
				<div className="horosa-kinastro-technique-rail">
					{propTechniqueTabs.map((item)=>(
						<button
							type="button"
							key={item.key}
							className={activeTechnique === item.key ? 'is-active' : ''}
							onClick={()=>this.props.onTechniqueChange && this.props.onTechniqueChange(item.key)}
						>
							{item.label}
						</button>
					))}
				</div>
			);
		}
		if(!this.config.showRail){
			return null;
		}
		const techniques = this.config.moduleKey === 'shusuan'
			? [
					{ key: 'shaozi', label: '邵子神数' },
					{ key: 'tieban', label: '铁板神数' },
					{ key: 'fendjing', label: '鬼谷分定经' },
					{ key: 'beiji', label: '北极神数' },
					{ key: 'nanji', label: '南极神数' },
					{ key: 'chunzi', label: '蠢子数' },
					{ key: 'canping', label: '邵子参评数' },
					{ key: 'heluo', label: '河洛理数' },
					{ key: 'zhengchuan', label: '神数正传' },
				]
			: [{ key: this.props.technique || this.config.serviceKey, label: this.config.techniqueLabel }];
		return (
			<div className="horosa-kinastro-technique-rail">
				{techniques.map((item)=>(
					<button
						type="button"
						key={item.key}
						className={(this.props.technique || this.config.serviceKey) === item.key ? 'is-active' : ''}
						onClick={()=>this.props.onTechniqueChange && this.props.onTechniqueChange(item.key)}
					>
						{item.label}
					</button>
				))}
			</div>
		);
	},
};
