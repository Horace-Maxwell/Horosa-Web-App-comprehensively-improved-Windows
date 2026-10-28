// 量化盘中点请求两条路(中点页 requestChart / AI 无头重算 buildGermanySnapshotForFields)发出的显示口径出参
// 必须与单源 germanyMidpointRequestParams 逐键相同 —— 页面那份曾手抄、漏了赤纬键,两边快照的后端段口径分叉。
var mockBodies = [];
jest.mock('../../../utils/request', () => ({
	__esModule: true,
	default: jest.fn(async (url, opts) => {
		let body = null;
		try{ body = JSON.parse(opts && opts.body); }catch(e){ body = null; }
		mockBodies.push({ url: `${url}`, body });
		return { Result: { midpoints: [], aspects: {}, tnp: [], declination: { parallel: [], contraParallel: [] } } };
	}),
}));
jest.mock('../../../utils/moduleAiSnapshot', () => ({ saveModuleAISnapshot: jest.fn(), loadModuleAISnapshot: jest.fn(() => null) }));
import AstroMidpoint, { germanyMidpointRequestParams, buildGermanySnapshotForFields } from '../AstroMidpoint';
import { getStoredUranianDisplay, saveUranianDisplay } from '../UranianDialStyle';
import moment from 'moment';

const KEYS = ['school', 'orb', 'personalOrb', 'declination', 'frames', 'strictFactors', 'davison'];
const pick = (b) => KEYS.reduce((o, k) => { if(b && b[k] !== undefined){ o[k] = b[k]; } return o; }, {});
const fields = () => {
	const v = (x) => ({ value: x });
	return { date: v(moment('1990-05-18')), time: v(moment('1990-05-18 10:00:00')), zone: v('+08:00'), lat: v('31n38'), lon: v('118e27'), gpsLat: v(31.63), gpsLon: v(118.45),
		hsys: v(1), zodiacal: v(0), siderealAyanamsa: v(''), tradition: v(0), strongRecption: v(0), simpleAsp: v(0), virtualPointReceiveAsp: v(0), name: v('x'), pos: v('') };
};
const midpointBody = () => (mockBodies.filter((r) => /\/germany\/midpoint$/.test(r.url)).pop() || {}).body;

describe('量化盘 /germany/midpoint 显示口径出参单源', () => {
	beforeEach(() => { mockBodies = []; try{ localStorage.clear(); }catch(e){ /* ignore */ } });
	[{}, { showDeclination: false }, { showHouseFrames: false }, { showHouseFrames: false, showEastPoint: true }, { school: 'cosmo', strictFactors: true, orb: 2 }].forEach((disp) => {
		it(`中点页与无头重算出参一致:${JSON.stringify(disp)}`, async () => {
			saveUranianDisplay(disp);
			const want = germanyMidpointRequestParams(getStoredUranianDisplay(), null);
			const page = new AstroMidpoint({ fields: fields() });
			page.saveGermanySnapshot = jest.fn();
			await page.requestChart({ date: '1990/05/18', time: '10:00:00', zone: '+08:00', lat: '31n38', lon: '118e27' });
			expect(pick(midpointBody())).toEqual(pick(want));
			mockBodies = [];
			await buildGermanySnapshotForFields(fields());
			expect(pick(midpointBody())).toEqual(pick(want));
			expect(midpointBody().declination).toBe(disp.showDeclination !== false);
		});
	});

	// 90° 中点盘页的本命中点请求(requestNatalTnp)同一函数:盘上 state 与显示偏好同键
	[{}, { showDeclination: false }, { showHouseFrames: false }, { showHouseFrames: false, showEastPoint: true }, { school: 'cosmo', strictFactors: true, orb: 2, orbPersonal: 3 }].forEach((disp) => {
		it(`90° 中点盘页出参与单源一致:${JSON.stringify(disp)}`, async () => {
			const UranianDialMain = require('../UranianDialMain').default;
			const fake = { state: { ...disp }, props: { fields: fields() }, unmounted: true, setState: () => {}, davisonPartnerParams: () => null };
			mockBodies = [];
			await UranianDialMain.prototype.requestNatalTnp.call(fake);
			expect(pick(midpointBody())).toEqual(pick(germanyMidpointRequestParams(disp, null)));
			expect(midpointBody().declination).toBe(disp.showDeclination !== false);
		});
	});
	it('90° 中点盘页不再手抄出参(源码锚)', () => {
		const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'UranianDialMain.js'), 'utf8');
		expect(src).toMatch(/return germanyMidpointRequestParams\(state, null\);/);
		expect(src).not.toMatch(/declination:\s*state\.showDeclination/);
	});
});
