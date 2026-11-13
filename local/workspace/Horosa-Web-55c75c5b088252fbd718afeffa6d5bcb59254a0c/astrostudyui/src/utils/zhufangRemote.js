// 诸方:人类图 / 灵名字母的后端结果(页面与无头挂载同一入口)。失败返回 null,调用方照出本地两段。
import request from './request';
import * as Constants from './constants';

export async function fetchZhufangRemote(params, settings){
	const s = settings || {};
	try{
		const data = await request(`${Constants.ServerRoot}/astroextra/zhufang`, {
			body: JSON.stringify({ ...(params || {}), hdTrueNode: s.hdTrueNode === false || `${s.hdTrueNode}` === '0' || s.hdTrueNode === 'mean' ? 0 : 1, spiritQuadrant: Number(s.spiritQuadrant) || 1 }),
			timeoutMs: 30000,
			silent: true,
		});
		const res = data && (data.Result || data);
		return res && (res.humanDesign || res.spiritNames) ? res : null;
	}catch(e){
		return null;
	}
}
