import { Component } from 'react';
import { Select } from 'antd';
import MapV2 from './MapV2';
import PropTypes from 'prop-types';
import { XQInput as Input, XQButton as Button } from '../xq-ui';
import { uuid, randomStr, gcj02ToGps, gpsToGcj02 } from '../../utils/helper';
import { safeLoadAMapUI } from './amapUIHelper';
import { dstAwareZoneAt } from '../../utils/timezone';
import { formatLonDms, formatLatDms } from '../astro/AstroHelper';
import CITIES from '../../data/cities.json';
import CITY_TRAD_SIMP from '../../data/cityTradSimpMap.json';
import { enrichCity, toCityItem, searchCities } from './cityMatch';
import styles from './GeoCoordSelector.less';

const { Option } = Select;

// 固定 UTC 偏移选项(照搬 DateTimeSelector.genZone,含半区 +05:30 等)。
const ZONE_OPTIONS = [
	['+00:00', '东0区'], ['+01:00', '东1区'], ['+02:00', '东2区'], ['+03:00', '东3区'],
	['+04:00', '东4区'], ['+04:30', '东4.5'], ['+05:00', '东5区'], ['+05:30', '东5.5'],
	['+06:00', '东6区'], ['+07:00', '东7区'], ['+08:00', '东8区'], ['+09:00', '东9区'],
	['+10:00', '东10'], ['+11:00', '东11'], ['+12:00', '东12'],
	['-01:00', '西1区'], ['-02:00', '西2区'], ['-03:00', '西3区'], ['-04:00', '西4区'],
	['-05:00', '西5区'], ['-05:30', '西5.5'], ['-06:00', '西6区'], ['-07:00', '西7区'],
	['-07:30', '西7.5'], ['-08:00', '西8区'], ['-09:00', '西9区'], ['-10:00', '西10'],
	['-11:00', '西11'],
];

// 成熟 atlas 地点选择：左栏「城市快搜 + 手输经纬」+ 右栏「高德地图选点/地名搜索」，
// 顶部实时显示当前 GPS 经纬度 + 依经纬度+日期自动推算的时区（含夏令时）。城市库离线可用，地图需联网。
class GeoCoordSelector extends Component{

	constructor(props) {
		super(props);
		this.state = {
			map: null,
			mapid: 'div' + randomStr(8),
			autoCompleteInputId: 'auinput_' + uuid(16, 16),
			autoSearch: null,
			marker: null,
			cityKeyword: '',       // 输入框即时值
			cityQuery: '',         // 防抖后用于过滤的值
			fullCities: null,      // 懒加载的大库(数组),未加载/失败为 null
			zoneOverride: null,    // 用户手动选的时区偏移(null = 跟随自动推断)
			manualLat: props.gpsLat !== undefined && props.gpsLat !== null ? `${props.gpsLat}` : '',
			manualLng: props.gpsLng !== undefined && props.gpsLng !== null ? `${props.gpsLng}` : '',
		};
		this._debounceTimer = null;
		this.handleMapCreated = this.handleMapCreated.bind(this);
		this.handleSearchSelect = this.handleSearchSelect.bind(this);
		this.handleMapClick = this.handleMapClick.bind(this);
		this.changePos = this.changePos.bind(this);
		this.applyGps = this.applyGps.bind(this);
		this.onManualApply = this.onManualApply.bind(this);
		this.onCityKeyword = this.onCityKeyword.bind(this);
		this.onZoneChange = this.onZoneChange.bind(this);
		this.onZoneAuto = this.onZoneAuto.bind(this);
	}

	componentDidMount(){
		// 动态懒加载全量城市库(避免进主 chunk / 拖慢首屏);失败则静默兜底仅用小库。
		import('../../data/citiesFull.json')
			.then((mod)=>{
				const arr = mod && mod.default ? mod.default : mod;
				if(Array.isArray(arr)){
					this.setState({ fullCities: arr });
				}
			})
			.catch(()=>{ /* 加载失败:仅用内置小库,功能不受影响 */ });
	}

	componentWillUnmount(){
		if(this._debounceTimer){
			clearTimeout(this._debounceTimer);
		}
	}

	// 关键词输入:即时回显 + 防抖(180ms)后再触发大库过滤,避免每键扫 3 万条卡顿。
	onCityKeyword(e){
		const v = e.target.value;
		this.setState({ cityKeyword: v });
		if(this._debounceTimer){
			clearTimeout(this._debounceTimer);
		}
		this._debounceTimer = setTimeout(()=>{
			this.setState({ cityQuery: v });
		}, 180);
	}

	// 把当前时区 override 附加到回传 info(无 override 则不带 zone,上层走自动推断)。
	withZone(info){
		if(this.state.zoneOverride){
			info.zone = this.state.zoneOverride;
		}
		return info;
	}

	// info.lat/lng 为高德 GCJ-02 坐标 → 转 GPS 回填。
	changePos(info){
		if(this.props.onChange){
			const geo = gcj02ToGps(info.lat, info.lng);
			info.gpsLat = geo.lat;
			info.gpsLng = geo.lon;
			this.props.onChange(this.withZone(info));
		}
	}

	// 直接按 GPS（城市库 / 手输）选点：GPS → GCJ 供地图显示，回填 GPS。
	// name:城市库直接给城市名;手输经纬度无名 → 传空串(表示「此坐标暂无地名」,上层据实回填/清名)。
	applyGps(gpsLat, gpsLng, name){
		const lat = Number(gpsLat);
		const lng = Number(gpsLng);
		if(!Number.isFinite(lat) || !Number.isFinite(lng)){
			return;
		}
		const gcj = gpsToGcj02(lat, lng);
		this.setState({ manualLat: `${lat}`, manualLng: `${lng}` });
		if(this.props.onChange){
			this.props.onChange(this.withZone({ lat: gcj.lat, lng: gcj.lon, gpsLat: lat, gpsLng: lng, name: name || '' }));
		}
	}

	// 用户手选时区:存 override 并回传(连同当前坐标,让上层立即生效)。
	onZoneChange(val){
		this.setState({ zoneOverride: val });
		const { lat, lng, gpsLat, gpsLng } = this.props;
		if(this.props.onChange && gpsLat !== undefined && gpsLat !== null && gpsLng !== undefined && gpsLng !== null){
			this.props.onChange({ lat: lat, lng: lng, gpsLat: gpsLat, gpsLng: gpsLng, zone: val });
		}
	}

	// 「自动」按钮:清除 override,回到按地点+日期自动推断的时区。
	onZoneAuto(){
		this.setState({ zoneOverride: null });
		const { lat, lng, gpsLat, gpsLng } = this.props;
		if(this.props.onChange && gpsLat !== undefined && gpsLat !== null && gpsLng !== undefined && gpsLng !== null){
			// 回传不带 zone:上层 changeGeo 见 geo.zone 缺失 → 恢复自动校正。
			this.props.onChange({ lat: lat, lng: lng, gpsLat: gpsLat, gpsLng: gpsLng });
		}
	}

	onManualApply(){
		this.applyGps(this.state.manualLat, this.state.manualLng);
	}

	handleMapCreated(map){
		if(this.state.autoSearch){
			return;
		}
		map.on('click', this.handleMapClick);
		const marker = new window.AMap.Marker({ position: new window.AMap.LngLat(116.39, 39.9) });
		map.add(marker);
		safeLoadAMapUI(['control/BasicControl'], (BasicControl)=>{
			map.addControl(new BasicControl.Zoom({ position: 'lt', showZoomNum: false }));
		});
		map.plugin(['AMap.AutoComplete'], ()=>{
			const auto = new window.AMap.AutoComplete({ input: this.state.autoCompleteInputId });
			auto.on('select', this.handleSearchSelect);
			this.setState({ map, autoSearch: auto });
		});
		this.setState({ marker });
	}

	handleSearchSelect(e){
		if(e.poi && e.poi.location){
			this.state.map.setZoom(13);
			this.state.map.setCenter(e.poi.location);
			this.state.marker.setPosition(e.poi.location);
			// 地名搜索选中:e.poi.name 即用户选的地名(如「上海市」「陆家嘴」),连同坐标透传上层。
			const name = (e.poi && e.poi.name) ? `${e.poi.name}` : '';
			this.changePos({ lat: e.poi.location.lat, lng: e.poi.location.lng, name });
		}
	}

	handleMapClick(e){
		const lat = e.lnglat.lat;
		const lng = e.lnglat.lng;
		// 地图裸点选:无现成地名 → 逆地理编码尽力取「区/县/市」名;取不到(服务未开/失败)则空串,据实回填。
		this.reverseGeocode(lng, lat, (name)=>{
			this.changePos({ lat, lng, name: name || '' });
		});
	}

	// 逆地理编码(高德 Geocoder,GCJ-02 坐标):尽力返回可读地名;任何失败/服务不可用一律回调空串,绝不抛错阻断选点。
	reverseGeocode(lng, lat, cb){
		try{
			if(!window.AMap || !window.AMap.plugin){
				cb('');
				return;
			}
			window.AMap.plugin(['AMap.Geocoder'], ()=>{
				try{
					const geocoder = new window.AMap.Geocoder({});
					geocoder.getAddress([lng, lat], (status, result)=>{
						let name = '';
						if(status === 'complete' && result && result.regeocode){
							const rc = result.regeocode;
							const comp = rc.addressComponent || {};
							const pick = (v)=>(v && typeof v === 'string') ? v : '';
							// 优先「区/县 → 乡镇/街道 → 城市 → 省」,再退回完整地址串。
							name = pick(comp.district) || pick(comp.township) || pick(comp.city)
								|| pick(comp.province) || pick(rc.formattedAddress) || '';
						}
						cb(name);
					});
				}catch(err){ cb(''); }
			});
		}catch(err){ cb(''); }
	}

	// 城市检索委托给纯函数模块 cityMatch(便于单测):简繁折叠 + 简体名 + 拼音/首字母 + 英文 + 地区,四档评分。
	filteredCities(){
		const raw = `${this.state.cityQuery || ''}`.trim();
		// 无关键词:仅显示内置小库常用城市(即时,无需等大库)。
		if(!raw){
			return CITIES.map((c)=>toCityItem(enrichCity(c)));
		}
		const lists = [CITIES];
		if(Array.isArray(this.state.fullCities)){
			lists.push(this.state.fullCities);
		}
		return searchCities(raw, lists, CITY_TRAD_SIMP, 80);
	}

	resolveDateStr(){
		const d = this.props.date;
		if(d && typeof d.format === 'function'){
			try{ return d.format('YYYY-MM-DD'); }catch(e){ /* noop */ }
		}
		if(typeof d === 'string' && d){
			return d.slice(0, 10);
		}
		// 兜底用今天：让弹窗时区预览始终可算（真实换算由表单 changeGeo→applyDstToFields 按出生日期处理）。
		const now = new Date();
		const p = (n)=>`${n}`.padStart(2, '0');
		return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
	}

	renderTzPreview(){
		const { gpsLat, gpsLng } = this.props;
		if(gpsLat === undefined || gpsLat === null || gpsLng === undefined || gpsLng === null){
			return <span className={styles.tzNone}>选择地点后自动推算时区</span>;
		}
		let info = null;
		try{ info = dstAwareZoneAt(Number(gpsLat), Number(gpsLng), this.resolveDateStr()); }catch(e){ info = null; }
		const autoOffset = info && info.offset ? info.offset : null;
		const isManual = !!this.state.zoneOverride;
		const selectVal = isManual ? this.state.zoneOverride : autoOffset;
		return (
			<span className={styles.tzInfo}>
				{info && info.zone
					? <span className={styles.tzZone}>{info.zone}</span>
					: <span className={styles.tzNone}>时区</span>}
				{info && info.dst && !isManual ? <span className={styles.tzDst}>夏令时</span> : null}
				{info && info.advisory === 'cn-unified' && !isManual ? (
					<span className={styles.tzDst} title="中国大陆统一按法定北京时间;出生记录若按当地惯用时间(新疆时间),可切 +06:00">
						官方 +08:00 · 当地惯用 +06:00
						<a onClick={()=>this.onZoneChange('+06:00')} style={{ marginLeft: 4 }}>按当地</a>
					</span>
				) : null}
				<Select
					size="small"
					className={styles.tzSelect}
					value={selectVal || undefined}
					placeholder="时区"
					onChange={this.onZoneChange}
				>
					{ZONE_OPTIONS.map(([v, label])=>(
						<Option key={v} value={v}>{`UTC${v} ${label}`}</Option>
					))}
				</Select>
				<Button
					size="small"
					className={styles.tzAuto}
					disabled={!isManual}
					onClick={this.onZoneAuto}
				>自动</Button>
			</span>
		);
	}

	render(){
		const hasPos = this.props.gpsLat !== undefined && this.props.gpsLat !== null
			&& this.props.gpsLng !== undefined && this.props.gpsLng !== null;
		if(hasPos && this.state.map){
			const pos = new window.AMap.LngLat(this.props.lng, this.props.lat);
			if(this.state.marker){ this.state.marker.setPosition(pos); }
			this.state.map.setCenter(pos);
		}
		const cities = this.filteredCities();

		return (
			<div className={styles.atlas}>
				<div className={styles.head}>
					<div className={styles.coord}>
						{hasPos
							? <span>{formatLonDms(Number(this.props.gpsLng))} · {formatLatDms(Number(this.props.gpsLat))}</span>
							: <span className={styles.coordNone}>尚未选择地点</span>}
					</div>
					<div className={styles.tz}>{this.renderTzPreview()}</div>
				</div>
				<div className={styles.body}>
					<div className={styles.side}>
						<div className={styles.sideLabel}>城市快搜</div>
						<Input
							allowClear
							value={this.state.cityKeyword}
							placeholder="搜城市（简繁 / 拼音 / 首字母 / 英文 / 地区）"
							onChange={this.onCityKeyword}
						/>
						<div className={styles.cityList}>
							{cities.length === 0 ? (
								<div className={styles.cityEmpty}>无匹配城市，可用右侧地图或下方手输</div>
							) : cities.map((c)=>(
								<button
									type="button"
									key={`${c.name}-${c.lat}-${c.lng}`}
									className={styles.cityItem}
									onClick={()=>this.applyGps(c.lat, c.lng, c.name)}
								>
									<span className={styles.cityName}>{c.name}</span>
									<span className={styles.cityRegion}>{c.region || ''}</span>
								</button>
							))}
						</div>
						<div className={styles.sideLabel}>手输经纬度（GPS 十进制）</div>
						<div className={styles.manualRow}>
							<Input
								value={this.state.manualLng}
								placeholder="经度"
								onChange={(e)=>this.setState({ manualLng: e.target.value })}
								onPressEnter={this.onManualApply}
							/>
							<Input
								value={this.state.manualLat}
								placeholder="纬度"
								onChange={(e)=>this.setState({ manualLat: e.target.value })}
								onPressEnter={this.onManualApply}
							/>
							<Button type="primary" onClick={this.onManualApply}>应用</Button>
						</div>
					</div>
					<div className={styles.mapWrap}>
						<Input
							className={styles.mapSearch}
							placeholder="在地图上搜索地名"
							id={this.state.autoCompleteInputId}
						/>
						<div id={this.state.mapid} className={styles.map}>
							<MapV2
								zoom={this.props.zoom ? this.props.zoom : 11}
								plugin={['AMap.AutoComplete']}
								uiplugin={['control/BasicControl', 'overlay/SimpleMarker']}
								created={this.handleMapCreated}
							/>
						</div>
					</div>
				</div>
			</div>
		);
	}
}

GeoCoordSelector.propTypes = {
	width: PropTypes.any,
	height: PropTypes.any,
	zoom: PropTypes.number,
	lat: PropTypes.number,
	lng: PropTypes.number,
	gpsLat: PropTypes.any,
	gpsLng: PropTypes.any,
	date: PropTypes.any,
	onChange: PropTypes.func,
};

export default GeoCoordSelector;
