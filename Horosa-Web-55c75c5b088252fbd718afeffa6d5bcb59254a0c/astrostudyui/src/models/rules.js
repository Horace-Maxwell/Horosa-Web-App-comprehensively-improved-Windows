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
			
			const { Result } = yield call(service.ziweirules, params);

			yield put({
                type: 'save',
                payload: {  
					ziwei: Result,
                },
			});
			
		},

	},
}