// 书籍阅读(astroreader)/ 星阙直播(liveplayer)/ 管理工具(admintools)三个旧云端页已下架:
// 导航清单、主页签、页头标题、导航弹窗、模型钩子、服务端点与它们独占的组件 / 依赖都不应再出现;
// 旧版温启快照里记着这三个页签时不恢复(否则落到空白页)。
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');
const UI = path.join(SRC, '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
const RETIRED = ['astroreader', 'liveplayer', 'admintools'];
const RETIRED_LABELS = ['书籍阅读', '星阙直播', '管理工具'];

describe('已下架的三个旧云端页', ()=>{
	const index = read('pages/index.js');

	test('导航清单(navigationPages)解析得到且不含这三个 key', ()=>{
		const keys = [];
		const re = /\{ label: '[^']+', key: '(\w+)'/g;
		let m;
		while((m = re.exec(index))){ keys.push(m[1]); }
		expect(keys.length).toBeGreaterThanOrEqual(25);
		expect(keys.filter((k)=>RETIRED.includes(k))).toEqual([]);
	});

	test('主页签(TabPane)不含这三个 key,也不再懒加载对应组件', ()=>{
		const tabKeys = [];
		const re = /<TabPane\b[^>]*\bkey="(\w+)"/g;
		let m;
		while((m = re.exec(index))){ tabKeys.push(m[1]); }
		expect(tabKeys.length).toBeGreaterThanOrEqual(25);
		expect(tabKeys.filter((k)=>RETIRED.includes(k))).toEqual([]);
		RETIRED.forEach((k)=>{
			expect(index).not.toContain(`'${k}'`);
			expect(index).not.toContain(`"${k}"`);
		});
		expect(index).not.toMatch(/components\/(reader|multimedia|admintools)\//);
		RETIRED_LABELS.forEach((label)=>expect(index).not.toContain(label));
	});

	test('页头标题、导航弹窗缺省页、模型钩子与书架状态都已清掉', ()=>{
		const header = read('components/homepage/PageHeader.js');
		const homeSetup = read('components/HomePageSetup.js');
		const astroModel = read('models/astro.js');
		const userModel = read('models/user.js');
		const userService = read('services/user.js');
		RETIRED.forEach((k)=>{
			expect(header).not.toContain(`${k}:`);
			expect(homeSetup).not.toContain(`'${k}'`);
			expect(astroModel).not.toContain(k);
		});
		expect(homeSetup).not.toContain('内容与管理');
		['bookshelf', 'currentBook', 'bookFields', 'listBooks', 'parseBookCatalogs'].forEach((w)=>{
			expect(userModel).not.toContain(w);
		});
		expect(userService).not.toContain('/astroreader/');
	});

	test('独占组件文件已删除', ()=>{
		[
			'components/reader', 'components/multimedia', 'components/admintools', 'components/logqry',
			'components/statis/Statis.js', 'components/user/UserMgmt.js', 'components/deeplearn/DLStatis.js',
			'components/comp/ConfirmSwitch.js', 'constants/ReaderConst.js',
		].forEach((rel)=>{
			expect(`${rel}:${fs.existsSync(path.join(SRC, rel))}`).toBe(`${rel}:false`);
		});
		// 命主实况问卷不在此列,必须留着
		expect(fs.existsSync(path.join(SRC, 'components/deeplearn/DLFeature.js'))).toBe(true);
	});

	test('只服务于直播 / 统计的 npm 依赖已从 package.json 去掉', ()=>{
		const pkg = JSON.parse(fs.readFileSync(path.join(UI, 'package.json'), 'utf8'));
		const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
		['flv.js', 'video.js', 'videojs-flash', 'numeral'].forEach((dep)=>{
			expect(`${dep}:${Object.prototype.hasOwnProperty.call(all, dep)}`).toBe(`${dep}:false`);
		});
	});

	test('温启恢复:快照里记着已下架页签时不恢复该页签', ()=>{
		const { RETIRED_MAIN_TABS } = require('../../models/app');
		expect([...RETIRED_MAIN_TABS].sort()).toEqual([...RETIRED].sort());
		const app = read('models/app.js');
		const line = app.split('\n').find((l)=>l.includes('currentTab: bootSnap.currentTab'));
		expect(line).toBeTruthy();
		expect(line).toContain('RETIRED_MAIN_TABS.indexOf(bootSnap.currentTab) < 0');
	});
});
