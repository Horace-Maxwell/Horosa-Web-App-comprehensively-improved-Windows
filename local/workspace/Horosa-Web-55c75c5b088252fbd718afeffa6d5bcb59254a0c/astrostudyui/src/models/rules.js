import { history } from 'umi';
import { Modal, } from 'antd';
import * as service from '../services/rules';


export default {
	namespace: 'rules',

	state: {
		ziwei: null,
	},

	reducers: {
		save(state, {payload: values}){
			let st = { ...state, ...values, };
			return st;
		},
	},

	effects: {
		*ziwei({ payload: values }, { call, put }){
            let params = { };

			// 走会话缓存:app 启动时本 effect 即 prime 缓存,之后紫微排盘路径零 RTT 命中。
			// prime 是 best-effort:App 启动时后端常在温启动中,失败属预期 → 静默跳过
			// (缓存层已保证空载荷不入缓存,真排盘路径会自然重试);不 toast、不打断启动。
			let data = null;
			try{
				data = yield call(service.ziweirulesCached, params);
			}catch(e){
				return;
			}
			if(!data){
				return;
			}
			yield put({
                type: 'save',
                payload: {
					ziwei: data.Result,
                },
			});

		},

	},
}