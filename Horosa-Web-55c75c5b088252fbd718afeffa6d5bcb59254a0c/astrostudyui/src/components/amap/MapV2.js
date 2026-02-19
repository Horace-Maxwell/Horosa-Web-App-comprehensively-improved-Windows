import { Component } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { AMapKey, AMapVer, AMapUIVer } from '../../utils/constants';
import {randomStr, } from '../../utils/helper';


class MapV2 extends Component {

	constructor(props) {
		super(props);

		this.state = {
			mapid: `map_${randomStr(8)}`,
			map: null,
		};

	}

	componentDidMount(){
		let plugin = [];
		if(this.props.plugin){
			plugin = this.props.plugin;
		}
		let uiplugin = [];
		if(this.props.uiplugin){
			uiplugin = this.props.uiplugin
		}
		AMapLoader.load({
			"key": `${AMapKey}`,              // 申请好的Web端开发者Key，首次调用 load 时必填
			"version": `${AMapVer}`,   // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
			"plugins": plugin,           // 需要使用的的插件列表，如比例尺'AMap.Scale'等
			"AMapUI": {             // 是否加载 AMapUI，缺省不加载
				"version": `${AMapUIVer}`,   // AMapUI 缺省 1.1
				"plugins": uiplugin,       // 需要加载的 AMapUI ui插件
			},
		}).then((AMap)=>{
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
		});
	}

	render(){
		const mapstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
		};

		return (
			<div id={this.state.mapid} style={mapstyle}>

			</div>
		)
	}

}

export default MapV2;
