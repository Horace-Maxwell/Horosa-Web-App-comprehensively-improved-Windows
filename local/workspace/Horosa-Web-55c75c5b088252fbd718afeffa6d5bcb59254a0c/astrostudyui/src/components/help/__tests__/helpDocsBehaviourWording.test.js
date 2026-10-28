// 手册与界面文字要说真话:每条锁「现在的实际行为」那句在、旧的错误说法不在。
// 读源文(确定性高,同时守住两层手册惰性构建的章节);行为本身由各自的行为测试锁住,这里只防文字漂回去。
import fs from 'fs';
import path from 'path';
import { HELP_DOCS } from '../../../utils/aiAnalysisHelpDocs';
import { classifyQuestion } from '../../../utils/aiAnalysisStarterPrompts';
import { NANJI_XIU_OPTIONS } from '../../kinastro/kinastroOptions';
import { TRASH_CAP, DELETED_LOG_CAP } from '../../../utils/localRecordStore';
import { DELETED_LOG_RECENT } from '../../user/DeletedLogPanel';

const SRC = path.join(__dirname, '..', '..', '..');
const R = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
const H = (name)=>R(`components/help/${name}.js`);

describe('AI 页「软件用法」帮助', ()=>{
	test('挂载案例的入口是顶栏「选择案例」,技法页菜单项叫「存为命盘」', ()=>{
		[HELP_DOCS.usage, HELP_DOCS.mount].forEach((doc)=>{
			expect(doc).toContain('顶栏「选择案例」');
			expect(doc).not.toContain('左栏「案例」');
			expect(doc).toContain('「存为命盘」');
			expect(doc).not.toContain('「保存为命盘」');
		});
		expect(H('AIAnalysisHelpDoc')).not.toContain('技法页排好盘并「保存为命盘」');
	});
	test('「行运大限」卡属紫微,八字看四柱盘下方的大运条', ()=>{
		const d = HELP_DOCS['concepts.daxian'];
		expect(d).not.toContain('八字看「行运大限」');
		expect(d).toContain('紫微看中栏下方「行运大限」卡');
		expect(d).toContain('八字看中栏四柱盘下方的大运 · 流年条');
	});
	test('导出类建议问题不再许诺对话导出 PDF,且仍归到导出帮助', ()=>{
		const src = R('utils/aiAnalysisStarterPrompts.js');
		expect(src).toContain("let STARTER_EXPORT_TEXT = '怎么导出对话或技法页的判读？';");
		expect(classifyQuestion('怎么导出对话或技法页的判读？')).toEqual({ category: 'software', helpKey: 'export' });
	});
});

describe('AI 分析手册', ()=>{
	const doc = H('AIAnalysisHelpDoc');
	test('改设置写明作用范围;自动规则写明「不会触发」;合盘写明按星盘 A 口径', ()=>{
		expect(doc).toContain('已载入的盘不变,要改当前这张请在技法页左栏选');
		expect(doc).toContain('标「此版本不会触发」并写明原因,排在列表最后,照样占 30 条的名额');
		expect(doc).toContain('两盘统一按本人那张盘的宫制、黄道与古典口径起');
		expect(doc).not.toContain('按 Provider / 模型');
	});
	test('空档说明拆成短条,不再一句写完', ()=>{
		expect(doc).toContain("kv('空档 · 随档 / 随盘'");
		expect(doc).toContain("kv('空档 · 宿占岁差'");
		expect(doc).not.toContain("kv('空档的意思'");
	});
});

describe('择日手册', ()=>{
	const doc = H('ZeriHelpDoc');
	test('紫微择日:排盘口径取紫微设置(扫描与点开的盘同一口径),工作台只设性别与时间算法', ()=>{
		expect(doc).not.toContain('在此同步对齐');
		expect(doc).not.toContain('工作台参数不会自动跟随紫微页,需手动设置');
		expect(doc).toContain('其余排盘口径(定年界线');
		expect(doc).toContain('一律取紫微设置(盘面左栏改的就是它)');
		expect(doc).toContain('时间算法缺省「直接时间」,紫微页缺省为真太阳时');
		expect(doc).toContain('点结果行不会替你改紫微设置');
	});
	test('七政择日:盘面样式起始沿用七政页,择日里改只作用于本页', ()=>{
		expect(doc).not.toContain('盘面样式与七政页共用');
		expect(doc).toContain('七政择日的盘面样式(星盘样式、分宫制、天星择日各项、立命时刻、显示偏好、流年神煞、盘形)起始沿用七政页记住的,在择日里改只作用于本页,不写回七政页');
	});
	test('三式择日:时间算法管奇门与六壬两家,点开的盘与扫描同一时柱', ()=>{
		expect(doc).not.toContain('六壬家扫描恒按真太阳时');
		expect(doc).toContain('时间算法作用于奇门家,六壬家随奇门取同一时柱、与三式合一页一样;太乙家恒按钟表时');
		expect(doc).toContain('起出的三式盘六壬层随奇门的时柱,与扫描时六壬家判的是同一时柱');
	});
	test('太乙择日只对齐内嵌盘;天星择日黄道宫制会记住;三式择日时间算法不再写成只管奇门', ()=>{
		expect(doc).not.toContain('同步回写到太乙页左栏');
		expect(doc).toContain('不改独立太乙页的设置');
		expect(doc).toContain('黄道、宫制会记住,下次打开天星页沿用');
		expect(doc).not.toContain('共享的时间算法');
		expect(doc).not.toContain('时间算法只作用于奇门家');
	});
});

describe('三式 / 奇门 / 六壬 / 太乙手册', ()=>{
	test('三式手册用改名后的标签', ()=>{
		const doc = H('SanshiHelpDoc');
		expect(doc).not.toMatch(/「贵人」|<b>昼夜阳阴<\/b>|昼夜阳阴 \/ 土旺衰|暗干、暗支、|左栏「贵人」下拉|（贵人、排盘/);
		expect(doc).toContain('左栏「选项·贵人体系」下拉');
		expect(doc).toContain('<b>昼夜阳阴归属</b>');
		expect(doc).toContain('暗支(随暗干)');
	});
	test('三式:时间算法不动外圈;历法服务不可用时按真太阳时并注明;阴盘不记住', ()=>{
		const doc = H('SanshiHelpDoc');
		expect(doc).not.toContain('地点、时间算法、性别、黄道坐标：');
		expect(doc).toContain('时间算法改后三式即时重排，外圈不变');
		expect(doc).toContain('(历法服务暂不可用,本次农历按真太阳时)');
		expect(doc).toContain('起局选「阴盘」即报数定局时照用但不记住');
		expect(doc).toContain('黄道 / 宫制按你在任一页上次亲手设的值起始新盘');
	});
	test('奇门手册标签与界面同名;阴盘不记住', ()=>{
		const doc = H('DunjiaHelpDoc');
		expect(doc).toContain('月家起局（仅排盘＝月家奇门时可用）');
		expect(doc).toContain("kv('暗支(随暗干)'");
		expect(doc).toContain('起局选「阴盘」照用但不记住');
		expect(doc).toContain('盘类、性别、报数、相关人员、移星、封局每盘单设，不记住');
	});
	test('六壬与三式对齐要十项(含时间算法);改时间算法会重新起课', ()=>{
		const doc = H('LiurengHelpDoc');
		expect(doc).toContain("kv('共用十项', '时间算法 / 贵人体系");
		expect(doc).not.toContain('共用九项');
		expect(doc).toContain('占问时间、地点、时间算法或全局日界（晚子时）</b>会重新起课');
	});
	test('太乙:几何法只由四项触发;农历日与节后天数随时间基准', ()=>{
		const doc = H('TaiyiHelpDoc');
		expect(doc).not.toContain('改动流派诸项后即改按此');
		expect(doc).not.toContain('改流派后改走几何逐宫累加');
		expect(doc).toContain('以及左上角的农历日与节后天数');
	});
});

describe('风水手册', ()=>{
	const doc = H('FengshuiHelpDoc');
	test('金锁玉关应期缺省就出;形态下拉与清除;不再写「快照」', ()=>{
		expect(doc).not.toContain('只是不出应期卡');
		expect(doc).not.toContain('填元运与流年后');
		expect(doc).toContain('元运默认九运、流年默认今年');
		expect(doc).toContain('原选形态不属新一侧时自动清掉');
		expect(doc).not.toContain('实时快照');
		expect(doc).not.toContain('快照永远是');
		expect(doc).not.toContain('AI 快照');
	});
});

describe('卜·其他 / 六爻 / 塔罗 / 分至手册', ()=>{
	test('六爻:载入事盘不改记住的设置;翻动中的限制;取历法失败的行为', ()=>{
		const doc = H('GuazhanHelpDoc');
		expect(doc).toContain('但不改你记住的设置');
		// 载入后再亲手改:只把这次改动叠到原先记住的那一套上,载入带来的流派等不记
		expect(doc).toContain('记住的是你原先那一套叠上这次改动，载入带来的流派与其余各项不记');
		expect(doc).toContain('翻动中不能保存（会提示先停止翻动）');
		expect(doc).toContain('日辰月建沿用上一次的');
		expect(doc).not.toContain('点一次「时间起卦」即补齐');
	});
	test('灵棋 / 地占 / 塔罗:「时间」「出生信息」档载回再起得到同一副', ()=>{
		const cn = H('CnyibuHelpDoc');
		expect(cn).toContain('「时间」档按存档那一分钟，仍是同一卦');
		expect(cn).toContain('「时间起卦」按存档那一刻，仍是同一盘');
		expect(cn).not.toContain('真值源');
		const ta = H('TarotHelpDoc');
		expect(ta).not.toContain('再点「抽牌」照它抽新的一副');
		expect(ta).toContain('「出生信息」档须先改时间地点');
		expect(ta).toContain('换了命盘名即换一副');
	});
	test('其他术数各子技法写明本机记住什么', ()=>{
		const cn = H('CnyibuHelpDoc');
		expect(cn.split('<div style={ct}>本机记忆</div>').length - 1).toBe(9);
		expect(cn).toContain('「直输五兆数」选了照用但不记');
		expect(cn).toContain('心易起卦法回到「年月日時起卦」');
		expect(cn).toContain('载入事盘只在本次显示存档那一套，不改这两项的记忆');
		// 小六壬 / 小成图 / 飞宫逐键写明:「左栏设置会记住」这句只剩轨策一处
		expect(cn.split('左栏设置会记住（起卦所得、手填的数与问事不记）').length - 1).toBe(1);
		expect(cn).toContain('流派与「一↔三」开关会记住；取数方式（按占时 / 手动三数）、手填的三数与问事不记，重开回到按占时取数');
		expect(cn).toContain('起卦法、配数流派、用宫、闢卦细判（正传 / 异文）会记住；手选的上下卦、动爻、种子与手录六爻');
		expect(cn).toContain('起支方式与河魁口径会记住；日干支取法（随盘 / 手动）与手选的干支');
	});
	test('分至页宿盘的外盘 / 盘型只改本页', ()=>{
		const doc = H('JieqiHelpDoc');
		expect(doc).not.toContain('改动会记在本机,下次打开沿用');
		expect(doc.split('不改宿盘页的设置,也不记在本机').length - 1).toBe(2);
	});
});

describe('命类手册', ()=>{
	test('演禽:23 点后不换日,不受日界 / 晚子时设置影响', ()=>{
		const doc = H('YanqinHelpDoc');
		expect(doc).not.toContain('晚子时、过子时归日按全局日界点设置自动处理');
		expect(doc).toContain('23 点以后出生不换日');
		expect(doc).toContain('不受全局日界点与晚子时设置影响');
	});
	test('演禽:挂载按挂载设置重起;我 / 彼随流派;写明记住什么', ()=>{
		const doc = H('YanqinHelpDoc');
		expect(doc).not.toContain('所见即所得');
		expect(doc).not.toContain('中传＝时禽(地禽 / 体 / 我)');
		expect(doc).toContain('默认翻禽＝我、倒将＝彼');
		expect(doc).toContain('入式历法与手动农历不记');
	});
	test('七政:起盘类九项的记住与随盘', ()=>{
		const doc = R('components/guolao/GuoLaoHelpDoc.js');
		expect(doc).toContain('记住与随盘(起盘类)');
		expect(doc).toContain('择日里内嵌的七政盘改这些项只改那一张');
	});
	test('七政:恒星岁差盘上空档回落本机记住的(含载入的盘),择日内嵌的只认本页;盘形写明择日不写记忆', ()=>{
		const doc = R('components/guolao/GuoLaoHelpDoc.js');
		expect(doc).toContain("kv('例外:恒星岁差', '宿度制为恒星制、盘上没选恒星岁差的盘(包括载入的命盘和 AI 分析按记录重算的盘),按本机记住的岁差算");
		expect(doc).toContain('择日里内嵌的七政盘只认本页,没选即郑式');
		expect(doc).toContain('方形盘(全局记忆,与宿占盘共用同一盘形偏好;择日里内嵌的七政盘改盘形只改那一张,不写这份记忆)');
	});
	test('数算:不记住的列全;刻制影响考刻刻位;手动古法时刻变也重填', ()=>{
		const doc = H('ShusuanHelpDoc');
		expect(doc).toContain('铁板起运年龄 / 考刻刻位 / 双胞胎分 / 过房养子');
		expect(doc.split('以及考刻刻位的可选范围').length - 1).toBe(2);
		expect(doc).toContain('同一天只改时刻(含步进小时、载入同日另一时辰的命例、交节当天跨过节气时刻)重填时支与节月');
		expect(doc).not.toContain('四柱段');
	});
	test('一掌经页:流年范围、记住什么;八字:其余口径按本机沿用;紫微:平太阳时', ()=>{
		const yz = H('YizhangjingHelpDoc');
		expect(yz).toContain('点选今年前后各 120 年内的任一年');
		expect(yz).toContain('重开软件后记住什么');
		expect(H('BaziHelpDoc')).toContain('主用流派与「显示」各项按本机上次所选沿用');
		expect(H('ZiweiHelpDoc')).toContain("kv('平太阳时'");
	});
	test('其余手册的小订正', ()=>{
		expect(H('DirectionHelpDoc')).toContain('/ 3° / 4° / 5°');
		expect(H('IndiaHelpDoc')).toContain('重开软件会接着显示上次那张盘,口径也是那张盘的');
		expect(H('XuanshiHelpDoc')).toContain('史事盘按新命盘的缺省口径起');
		expect(H('RelativeHelpDoc')).toContain('也会记作新命盘的缺省');
		expect(H('Astro3DHelpDoc')).toContain('也会记作新命盘的缺省');
		expect(H('AstroHelpDoc')).toContain('命盘、事盘的回收站各最多存 200 条');
	});
});

describe('档案管理手册(星盘手册「档案管理」页签)', ()=>{
	const doc = H('AstroHelpDoc');
	const records = doc.slice(doc.indexOf('<TabPane tab="档案管理"'), doc.indexOf('</TabPane>', doc.indexOf('<TabPane tab="档案管理"')));
	test('页签切得出来', ()=>{
		expect(records.length).toBeGreaterThan(2000);
	});
	test('回收站:各项上限与内核 / 界面同一个数;存储满了也能删;删除日志有容量、界面能列出全部留着的条目', ()=>{
		expect(records).toContain(`回收站各最多存 ${TRASH_CAP} 条`);
		expect(records).toContain(`删除日志也有容量（命盘、事盘合计最多存 ${DELETED_LOG_CAP} 条）`);
		expect(records).toContain(`缺省列最近 ${DELETED_LOG_RECENT} 条，点「显示全部」列出日志里留着的每一条，可按名字或时间搜`);
		expect(records).toContain('本机存储空间满了也照样能删：删掉的记录随即腾出空间，回收站写不进的那条直接记进删除日志');
		expect(records).toContain('连删除日志也写不进时删除照样生效，顶部会出提示，点「导出这些记录」');
		expect(records).toContain('再满时最早的条目被挤掉，从此找不回');
		expect(records).toContain('会挤掉日志里最早的几条时也会写明有几条将被永久删除');
		expect(records).not.toContain('（最近 8 条，命盘、事盘两边都有）');
		expect(records).not.toContain('删除不执行并如实提示');
	});
	test('导入:同一 ID 较新的整条胜出、列表状态留本机,不按字段混合;名人库条目例外;本机之后删掉的不带回', ()=>{
		expect(records).not.toContain('导入是按记录合并');
		expect(records).toContain('文件里较新的整条替换本机的（置顶、星标、归档等列表状态留本机的），本机较新或一样新的保留本机的，不按字段混合');
		expect(records).toContain('名人库页复制出的条目例外：本机已有这位时按字段合并，只刷新出生数据');
		expect(records).toContain('普通备份文件里，本机在这份文件之后删掉的（还在回收站或删除日志里的）不带回');
	});
	test('全量恢复:较新者整条胜出、备份之后删掉的不带回、可勾「一律用备份里的」、权限类开关取较严;换机迁移不再与之矛盾', ()=>{
		expect(records).not.toContain('命盘/事盘按记录合并');
		expect(records).not.toContain('换机迁移用这一对菜单项即可');
		expect(records).not.toContain('人生事件按事件求并集（同 ID 保留本机版本）');
		expect(records).toContain('同一 ID 的两份，更新时间较新的那份整条保留（本机较新或一样新的保留本机的；整条替换时置顶、星标、归档等列表状态留本机的）');
		expect(records).toContain('你在备份之后删掉的命盘 / 事盘（还在本机回收站或删除日志里的）不带回');
		expect(records).toContain('在确认框里勾「同一 ID 的命盘 / 事盘一律用备份里的」');
		expect(records).toContain('人生事件按事件合并（同一事件保留本机的，本机删过的不再带回）');
		expect(records).toContain('逐项取本机与备份里较严的一档（开关取「关」，审批取更严的档，命主实况只留两边都开着的命盘），恢复不会放宽这些权限');
		expect(records).toContain('需要时到 AI 分析页「进阶 → AI 助手行动能力」里重新打开');
		expect(records).toContain('AI 接口密钥不随备份');
	});
	test('权限类开关逐项列名与恢复预览用的名字一致', ()=>{
		const ub = R('utils/unifiedBackup.js');
		const names = [];
		const re = /'horosa\.ai\.[a-zA-Z.]+(?:\.v1)?': '([^']+)'/g;
		const sec = ub.slice(ub.indexOf('const SECURITY_SHORT_NAMES'), ub.indexOf('};', ub.indexOf('const SECURITY_SHORT_NAMES')));
		let m = re.exec(sec);
		while(m){ names.push(m[1]); m = re.exec(sec); }
		expect(names.length).toBe(16);
		names.forEach((n)=>expect([n, records.indexOf(n) >= 0]).toEqual([n, true]));
	});
	test('自动备份、影子副本、存储横幅、独立实例各有说明', ()=>{
		expect(records).toContain('<b>自动备份</b>');
		expect(records).toContain('「Horosa Backups」文件夹下本应用专用的子文件夹');
		expect(records).toContain('<b>影子副本</b>');
		expect(records).toContain('<b>存储提示横幅</b>');
		['「存储内容损坏」', '「本地储存暂不可用」', '「本地存储空间不足：刚删除的几条没能留进回收站或删除日志」', '「本机存储像是被清空过」', '「上次退出前最后的保存可能没写进」', '「读到更新版本的软件写的记录」',
			'「并回这些记录」', '「以本机为准」', '「导出这些记录」', '「从最近的自动备份恢复」'].forEach((x)=>expect(records).toContain(x));
		expect(records).toContain('点「以本机为准」则丢弃影子里这几条，用本机这份刷新影子副本');
		expect(records).toContain('选之前这几个库暂停写影子副本，之后新存的记录没有影子保护');
		expect(records).toContain('不做自动备份、也不做影子副本，请记得手动导出');
		expect(records).not.toContain('若看到「暂存内存」横幅');
		expect(records).not.toContain('从最近的自动备份恢复全部数据');
	});
});

describe('AI 分析手册 · 行动能力卡', ()=>{
	test('写明权限类开关随全量恢复取较严的一档、换机后要自己重新打开', ()=>{
		const doc = H('AIAnalysisHelpDoc');
		expect(doc).toContain("kv('全量备份与恢复'");
		expect(doc).toContain('逐项取本机与备份里较严的一档:开关取关、审批取更严的档,恢复不会放宽权限;换机迁移后这些开关停在关,需要时在这里重新打开');
	});
});

describe('界面文字', ()=>{
	test('神数页提示不露内部说法;南极二十八宿显示「氐」、值仍是后端认的写法', ()=>{
		const km = R('components/kinastro/KinAstroMain.js');
		expect(km).not.toContain('后端至少两字才检索');
		expect(km).not.toContain('写进框架卡与快照');
		expect(km).not.toContain('在四柱段注明');
		expect(km).not.toContain('条文库无');
		const di = NANJI_XIU_OPTIONS.find((o)=>o.value === '氏');
		expect(di).toEqual({ value: '氏', label: '氐' });
		expect(NANJI_XIU_OPTIONS.some((o)=>o.label === '氏')).toBe(false);
	});
	test('金口诀概览不露「后端」与报错原文', ()=>{
		const jk = R('components/jinkou/JinKouMain.js');
		expect(jk).not.toContain('后端盘按');
		expect(jk).not.toContain('后端排盘未就绪（${this.state.jinkouError}）');
		expect(jk).toContain("['排盘来源', '排盘服务暂时不可用，已改用内置算法起课；四位与断法照常，三盘环等内容可能缺失。']");
	});
});
