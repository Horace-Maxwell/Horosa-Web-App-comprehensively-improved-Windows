import { Component } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { AMapKey, AMapVer, AMapUIVer } from '../../utils/constants';
import {randomStr, } from '../../utils/helper';
import { canUseAMapUI, } from './amapUIHelper';
import { hasMapConsent, grantMapConsent } from '../../utils/mapConsent';


class MapV2 extends Component {

	constructor(props) {
		super(props);

		this.state = {
			mapid: `map_${randomStr(8)}`,
			map: null,
			// 一次性知情同意闸:未同意前不加载第三方地图脚本(不产生任何出站请求),
			// 面板内确认后才 load;拒绝路径 = 调用方的手动输入经纬度等本地方式。
			consented: hasMapConsent(),
		};

	}

	componentDidMount(){
		this._mounted = true;
		if(this.state.consented){
			this.loadMap();
		}
	}

	loadMap = () => {
		let plugin = [];
		if(this.props.plugin){
			plugin = this.props.plugin;
		}
		let uiplugin = [];
		if(this.props.uiplugin){
			uiplugin = this.props.uiplugin
		}
		const loadOpts = {
			"key": `${AMapKey}`,              // 申请好的Web端开发者Key，首次调用 load 时必填
			"version": `${AMapVer}`,   // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
			"plugins": plugin,           // 需要使用的的插件列表，如比例尺'AMap.Scale'等
		};
		if(canUseAMapUI() && uiplugin.length){
			loadOpts.AMapUI = {
				"version": `${AMapUIVer}`,
				"plugins": uiplugin,
			};
		}
		AMapLoader.load(loadOpts).then((AMap)=>{
			if(!this._mounted) return; // 卸载后不再建图/setState
			let map = new AMap.Map(this.state.mapid);
			this.setState({
				map: map,
			}, ()=>{
				if(this.props.zoom){
					map.setZoom(this.props.zoom);
				}
				if(this.props.created){
					this.props.created(map);
				}
			});
		}).catch((err)=>{
			console.warn('[MapV2] amap loader unavailable, keep page interactive.', err);
			if(this.props.onLoadError){
				this.props.onLoadError(err);
			}
		});
	}

	handleConsent = () => {
		grantMapConsent();
		this.setState({ consented: true }, this.loadMap);
	}

	componentWillUnmount(){
		// 销毁 AMap 实例，防多次进出页面累积泄漏
		if(this.state.map){
			try{ this.state.map.destroy(); }catch(e){}
		}
		this._mounted = false;
	}

	render(){
		const mapstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
		};

		if(!this.state.consented){
			return (
				<div style={{
					...mapstyle,
					display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
					gap: 10, padding: 16, boxSizing: 'border-box', textAlign: 'center',
					border: '1px dashed var(--horosa-border, #d9d9d9)', borderRadius: 8,
					color: 'var(--horosa-text-soft, #666)', fontSize: 12, lineHeight: 1.7,
				}}>
					<div style={{ maxWidth: 420 }}>
						在线地图由第三方「高德地图」提供。继续使用将加载其在线服务,并向其服务器(位于中国境内)发送你的
						IP 地址与地图交互请求;地图仅用于选取经纬度,本软件不向其发送你的命盘等其他数据。
						你也可以不使用地图,直接手动输入经纬度或搜索城市。
					</div>
					<button
						type="button"
						onClick={this.handleConsent}
						style={{
							padding: '5px 18px', borderRadius: 6, cursor: 'pointer',
							border: '1px solid var(--horosa-accent, #1677ff)',
							background: 'var(--horosa-accent, #1677ff)', color: 'var(--horosa-on-accent)', fontSize: 12,
						}}
					>
						同意并加载地图
					</button>
					<div style={{ fontSize: 11, opacity: 0.75 }}>本选择仅需确认一次;详见「关于」内的隐私政策。</div>
				</div>
			);
		}

		return (
			<div id={this.state.mapid} style={mapstyle}>

			</div>
		)
	}

}

export default MapV2;
