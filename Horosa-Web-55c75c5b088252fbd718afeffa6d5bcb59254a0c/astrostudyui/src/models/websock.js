import { globalWS, } from '../utils/WebSock';
import { NeedWS } from '../utils/constants';

export default {
	namespace: 'websock',
	state:{

	},

	reducers: {
		save(state, {payload: values}){
			let st = { ...state, ...values, };
			return st;
		},

	},

	effects: {
		*send({ payload: values }, { call, put }){
			if(NeedWS){
				globalWS.send(values.cmd, values.data);
			}
		},

		*setCmd({ payload: values }, { call, put }){
			if(NeedWS){
				globalWS.setCmd(values.cmd, values.handler);
			}
		},

	},

	subscriptions: {
		setup({ dispatch, history }) {
			if(NeedWS){
				globalWS.connect();
			}
		},
	},
};
