package spacex.astrostudycn.model;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.FiveElement;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.constants.Polarity;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudy.helper.WuXingPhaseHelper;
import spacex.astrostudy.model.NongLi;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.ZiWeiStarType;
import spacex.astrostudycn.helper.ZiWeiHelper;

public class ZiWeiChart {
	protected NongLi nongli;
	protected ZiWeiHouse[] houses = new ZiWeiHouse[12];
	protected int lifeHouseIndex = 0;
	protected int bodyHouseIndex = 0;
	protected int wuxingJu;
	protected String wuxingJuText;
	protected int ziweiIndex;
	protected BaZiGender gender;
	protected String yearGan;
	protected String yearZi;
	protected Polarity yearPolar;
	protected String timeZi;
	protected String lifeMaster;
	protected String bodyMaster;
	protected String zidou;
	protected String doujun;
	
	protected transient Map<String, Map<String, String>> mySihua;
	protected transient Map<String, Map<String, Set<String>>> mySihuaGan;
	
	protected Map<String, Integer> starsHouseIndex;
	
	protected String birth;
	protected String zone;
	protected String lon;
	protected String lat;
	protected int ad;
	
	protected Map<String, Object> bazi = new HashMap<String, Object>();
	
	public ZiWeiChart(int ad, BaZiGender gender, String birth, String zone, String lon, String lat, boolean after23NewDay, Map<String, Map<String, String>> mysihua) {
		this(ad, gender, birth, zone, lon, lat, after23NewDay, mysihua, false);
	}
	
	public ZiWeiChart(int ad, BaZiGender gender, String birth, String zone, String lon, String lat, boolean after23NewDay, Map<String, Map<String, String>> mysihua, boolean adjustJieqi) {
		this.gender = gender;
		this.birth = birth.replace('/', '-');
		this.zone = zone;
		this.lat = lat;
		this.lon = lon;
		this.ad = ad;
		if(birth.startsWith("-")) {
			this.ad = -1;
		}
		
		this.mySihua = mysihua;
		initSihuaGan();
		
		this.nongli = NongliHelper.getNongLi(this.ad, birth, zone, lon, after23NewDay);
		this.yearGan = this.nongli.year.substring(0, 1);
		this.yearZi = this.nongli.year.substring(1);
		this.timeZi = this.nongli.time.substring(1);
		this.yearPolar = StemBranch.getStemPolar(this.yearGan);

		for(int i=0; i<this.houses.length; i++) {
			this.houses[i] = new ZiWeiHouse();
		}
		
		this.starsHouseIndex = new HashMap<String, Integer>();
		this.lifeMaster = ZiWeiHelper.StarsLifeMaster.get(this.yearZi);
		this.bodyMaster = ZiWeiHelper.StarsBodyMaster.get(this.yearZi);
		this.zidou = ZiWeiHelper.getDouJun(this.nongli.month, this.timeZi);
		int douidx = (StemBranch.BranchIndex.get(this.zidou) + StemBranch.BranchIndex.get(this.yearZi)) % 12;
		this.doujun = StemBranch.Branches[douidx];
		
		setup();
		
		OnlyFourColumns bz = new OnlyFourColumns(ad, birth, zone, lon, lat, after23NewDay, gender, adjustJieqi);
		this.bazi = bz.getNongli();
		
	}
	
	private void initSihuaGan() {
		if(this.mySihua == null) {
			return;
		}
		
		Map<String, Map<String, String>> sihuamap = ZiWeiHelper.cloneSihua();
		sihuamap.putAll(this.mySihua);
		this.mySihua = sihuamap;
		
		this.mySihuaGan = new HashMap<String, Map<String, Set<String>>>();
		for(Map.Entry<String, Map<String, String>> entry : sihuamap.entrySet()) {
			String gan = entry.getKey();
			Map<String, String> stars = entry.getValue();
			for(Map.Entry<String, String> starentry : stars.entrySet()) {
				String star = starentry.getKey();
				String hua = starentry.getValue();
				Map<String, Set<String>> sihuagan = (Map<String, Set<String>>) this.mySihuaGan.get(star);
				if(sihuagan == null) {
					sihuagan = new HashMap<String, Set<String>>();
					this.mySihuaGan.put(star, sihuagan);
				}
				Set<String> set = (Set<String>) sihuagan.get(hua);
				if(set == null) {
					set = new HashSet<String>();
					sihuagan.put(hua, set);
				}
				set.add(gan);
			}
		}
	}
	
	private boolean isClockwise() {
		if((this.gender == BaZiGender.Male && this.yearPolar == Polarity.Positive) || 
				(this.gender == BaZiGender.Female && this.yearPolar == Polarity.Negative)) {
			return true;
		}
		return false;
	}
	
	private void setup() {
		setupHouseGanZi();
		setupLifeBodyHouse();
		setupZiWeiPos();
		setupStarsMain();
		setupStarsByYear();
		setupTianCouCai();
		setupStarsByMonth();
		setupStarsByTimeZi();
		setupStarsHuoLin();
		setupStarsByDays();
		setupStarsXunEmpty();
		setupStarsBosi();
		setupStarsJiang();
		setupStarsTaiSui();
		
		setupSmallDirection();
	}
	
	private void setupHouseGanZi() {
		String yeargan = this.yearGan;
		String startgan = ZiWeiHelper.HouseGanStart.get(yeargan);
		int startganIdx = StemBranch.StemIndex.get(startgan);
		this.houses[0].ganzi = StemBranch.Stems[startganIdx] + StemBranch.Branches[0];
		this.houses[1].ganzi = StemBranch.Stems[(startganIdx + 1) % 10] + StemBranch.Branches[1];
		
		for(int i=2; i<12; i++) {
			this.houses[i].ganzi = StemBranch.Stems[(startganIdx + i - 2) % 10] + StemBranch.Branches[i];
		}
	}
	
	private void setupLifeBodyHouse() {
		int month = this.nongli.monthInt;
		if(this.nongli.leap && this.nongli.dayInt >= 16) {
			month++;
		}
		int loc = StemBranch.BranchIndex.get(StemBranch.BRANCH_YIN) + month - 1;
		int tmIdx = StemBranch.BranchIndex.get(this.nongli.time.substring(1));
		
		this.lifeHouseIndex = (loc - tmIdx + 24) % 12;
		this.bodyHouseIndex = (loc + tmIdx) % 12;
		
		this.houses[this.lifeHouseIndex].isLife = true;
		this.houses[this.bodyHouseIndex].isBody = true;
		
		String lifeganzi = this.houses[this.lifeHouseIndex].ganzi;
		FiveElement nayingelem = StemBranch.getNaYingElement(lifeganzi);
		this.wuxingJu = ZiWeiHelper.FiveElementNum.get(nayingelem.toString());
		this.wuxingJuText = ZiWeiHelper.WuxingJuText.get(this.wuxingJu);
		
		String zi = WuXingPhaseHelper.getPhaseZi(PhaseType.ShuiTu, nayingelem, "长生");
		int csIdx = StemBranch.BranchIndex.get(zi);
				
		for(int i=0; i<12; i++) {
			int phaseIdx = csIdx;
			if(isClockwise()) {
				phaseIdx = (i - csIdx + 24) % 12;
			}else {
				phaseIdx = (csIdx - i + 24) % 12;
			}
			this.houses[i].phase = ZiWeiHelper.ChangSheng12[phaseIdx];
			
			int delta = i - this.lifeHouseIndex;
			int idx = Math.abs(delta);
			if(delta > 0) {
				idx = 12 - delta;
			}
			this.houses[i].name = ZiWeiHelper.Houses[idx];
			if(isClockwise()) {
				if(idx == 0) {
					this.houses[i].direction[0] = this.wuxingJu;
					this.houses[i].direction[1] = this.wuxingJu + 9;
				}else {
					this.houses[i].direction[0] = 10*(12-idx) + this.wuxingJu;
					this.houses[i].direction[1] = 10*(12-idx) + this.wuxingJu + 9;					
				}
			}else {
				this.houses[i].direction[0] = 10*idx + this.wuxingJu;
				this.houses[i].direction[1] = 10*idx + this.wuxingJu + 9;				
			}
		}
	}
	
	private void setupZiWeiPos() {
		int rest = this.nongli.dayInt % this.wuxingJu;
		int div = this.nongli.dayInt / this.wuxingJu;
		if(rest == 0) {
			this.ziweiIndex = (1 + div) % 12;
		}else {
			div++;
			rest = this.wuxingJu * div - this.nongli.dayInt;
			if(rest % 2 == 0) {
				this.ziweiIndex = (1 + div + rest) % 12;
			}else {
				this.ziweiIndex = (1 + div - rest + 24) % 12;
			}
		}
	}
	
	private void setupTianCouCai() {
		int idx = StemBranch.BranchIndex.get(this.yearZi);
		if(idx > 0) {
			idx = 11 - idx;
		}
		String housename = ZiWeiHelper.Houses[idx];
		for(int i=0; i<12; i++) {
			if(this.houses[i].name.equals(housename)) {
				String housezi = this.houses[i].ganzi.substring(1);
				ZiWeiStar star = new ZiWeiStar("天才", this.yearGan, housezi, this.mySihua, this.mySihuaGan);
				this.houses[i].addStar(star, ZiWeiStarType.StarOtherGood.getCode());
				this.starsHouseIndex.put("天才", i);
				break;
			}
		}
		
		idx = this.bodyHouseIndex;
		int yearziIdx = StemBranch.BranchIndex.get(this.yearZi);
		idx = (idx + yearziIdx + 24) % 12;
		String housezi = this.houses[idx].ganzi.substring(1);
		ZiWeiStar star = new ZiWeiStar("天寿", this.yearGan, housezi, this.mySihua, this.mySihuaGan);
		this.houses[idx].addStar(star, ZiWeiStarType.StarOtherGood.getCode());
		this.starsHouseIndex.put("天寿", idx);
	}
		
	private void setupStarsMain() {
		int ziweiIdx = this.ziweiIndex;
		int tianfuidx = ziweiIdx;
		if(ziweiIdx >= 2 && ziweiIdx <= 8) {
			int delta = ziweiIdx - 2;
			tianfuidx = (2 - delta + 24) % 12;
		}else {
			int delta = ziweiIdx - 8;
			tianfuidx = (8 - delta + 24) % 12;
		}
		
		for(Map.Entry<String, Integer> entry: ZiWeiHelper.NorthStarsMainStep.entrySet()) {
			String star = entry.getKey();
			Integer step = entry.getValue();
			int idx = (ziweiIdx + step + 24) % 12;
			String housezi = this.houses[idx].ganzi.substring(1);
			ZiWeiStar zwstar = new ZiWeiStar(star, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
			this.houses[idx].starsMain.add(zwstar);
			this.starsHouseIndex.put(star, idx);
		}
		for(Map.Entry<String, Integer> entry: ZiWeiHelper.SouthStarsMainStep.entrySet()) {
			String star = entry.getKey();
			Integer step = entry.getValue();
			int idx = (tianfuidx + step + 24) % 12;
			String housezi = this.houses[idx].ganzi.substring(1);
			ZiWeiStar zwstar = new ZiWeiStar(star, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
			this.houses[idx].starsMain.add(zwstar);		
			this.starsHouseIndex.put(star, idx);
		}
	}
	
	private void setupStarsByYear() {
		for(Map.Entry<String, Map<String, Object>> entry : ZiWeiHelper.StarsYearGan.entrySet()) {
			String starname = entry.getKey();
			Map<String, Object> map = entry.getValue();
			int type = (int) map.get("type");
			Map<String, String> pos = (Map<String, String>) map.get("pos");
			String zi = pos.get(this.yearGan);
			if(zi.length() == 2) {
				int idx = StemBranch.BranchIndex.get(zi.substring(0, 1));
				String housezi = this.houses[idx].ganzi.substring(1);
				Polarity housepol = StemBranch.BranchPolarityMap.get(housezi);
				String sname = starname;
				if(housepol != this.yearPolar) {
					sname = "副" + starname;
				}
				ZiWeiStar star = new ZiWeiStar(sname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
				this.houses[idx].addStar(star, type);	
				this.starsHouseIndex.put(starname, idx);
				
				idx = StemBranch.BranchIndex.get(zi.substring(1));
				housezi = this.houses[idx].ganzi.substring(1);
				star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
				this.houses[idx].addStar(star, type);
				this.starsHouseIndex.put(starname, idx);
			}else {
				int idx = StemBranch.BranchIndex.get(zi);
				String housezi = this.houses[idx].ganzi.substring(1);
				ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
				this.houses[idx].addStar(star, type);	
				this.starsHouseIndex.put(starname, idx);
			}
		}
		
		for(Map.Entry<String, Map<String, Object>> entry : ZiWeiHelper.StarsYearZi.entrySet()) {
			String starname = entry.getKey();
			Map<String, Object> map = entry.getValue();
			int type = (int) map.get("type");
			Map<String, String> pos = (Map<String, String>) map.get("pos");
			String zi = pos.get(this.yearZi);
			int idx = StemBranch.BranchIndex.get(zi);
			String housezi = this.houses[idx].ganzi.substring(1);
			ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
			this.houses[idx].addStar(star, type);
			this.starsHouseIndex.put(starname, idx);
		}
	}
	
	private void setupStarsByMonth() {
		for(Map.Entry<String, Map<String, Object>> entry : ZiWeiHelper.StarsMonth.entrySet()) {
			String starname = entry.getKey();
			Map<String, Object> map = entry.getValue();
			int type = (int) map.get("type");
			Map<String, String> pos = (Map<String, String>) map.get("pos");
			String zi = pos.get(this.nongli.month);
			int idx = StemBranch.BranchIndex.get(zi);
			String housezi = this.houses[idx].ganzi.substring(1);
			ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
			this.houses[idx].addStar(star, type);
			this.starsHouseIndex.put(starname, idx);
		}
	}
	
	private void setupStarsByTimeZi() {
		for(Map.Entry<String, Map<String, Object>> entry : ZiWeiHelper.StarsTimeZi.entrySet()) {
			String starname = entry.getKey();
			Map<String, Object> map = entry.getValue();
			int type = (int) map.get("type");
			Map<String, String> pos = (Map<String, String>) map.get("pos");
			String zi = pos.get(this.timeZi);
			int idx = StemBranch.BranchIndex.get(zi);
			String housezi = this.houses[idx].ganzi.substring(1);
			ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
			this.houses[idx].addStar(star, type);
			this.starsHouseIndex.put(starname, idx);
		}
	}
	
	private void setupStarsHuoLin() {
		Map<String, Object> stars = (Map<String, Object>) ZiWeiHelper.StarsHuoLin.get(this.yearZi);
		for(Map.Entry<String, Object> entry : stars.entrySet()) {
			String starname = entry.getKey();
			Map<String, Object> map = (Map<String, Object>)entry.getValue();
			String zi = (String)map.get(this.timeZi);
			int idx = StemBranch.BranchIndex.get(zi);
			String housezi = this.houses[idx].ganzi.substring(1);
			ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
			this.houses[idx].addStar(star, ZiWeiStarType.StarEvil.getCode());
			this.starsHouseIndex.put(starname, idx);
		}
	}
	
	private void setupStarsByDays() {
		String starname = "三台";
		int idx = (this.starsHouseIndex.get("左辅") + this.nongli.dayInt + 11) % 12;
		String housezi = this.houses[idx].ganzi.substring(1);
		ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
		this.houses[idx].addStar(star, ZiWeiStarType.StarOtherGood.getCode());
		this.starsHouseIndex.put(starname, idx);
		
		starname = "八座";
		idx = (this.starsHouseIndex.get("右弼") - this.nongli.dayInt + 37) % 12;
		housezi = this.houses[idx].ganzi.substring(1);
		star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
		this.houses[idx].addStar(star, ZiWeiStarType.StarOtherGood.getCode());
		this.starsHouseIndex.put(starname, idx);
		
		starname = "恩光";
		idx = (this.starsHouseIndex.get("文昌") + this.nongli.dayInt + 10) % 12;
		housezi = this.houses[idx].ganzi.substring(1);
		star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
		this.houses[idx].addStar(star, ZiWeiStarType.StarOtherGood.getCode());
		this.starsHouseIndex.put(starname, idx);
		
		starname = "天贵";
		idx = (this.starsHouseIndex.get("文曲") + this.nongli.dayInt + 10) % 12;
		housezi = this.houses[idx].ganzi.substring(1);
		star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
		this.houses[idx].addStar(star, ZiWeiStarType.StarOtherGood.getCode());
		this.starsHouseIndex.put(starname, idx);
	}
	
	private void setupStarsXunEmpty() {
		Set<String> emptySet = StemBranch.getXunEmptySet(this.nongli.year);
		for(int i=0; i<this.houses.length; i++) {
			ZiWeiHouse house = this.houses[i];
			String zi = house.ganzi.substring(1);
			if(emptySet.contains(zi)) {
				String starname = "旬空";
				Polarity housepol = StemBranch.BranchPolarityMap.get(zi);
				if(housepol != this.yearPolar) {
					starname = "副" + starname;
				}
				ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, zi, this.mySihua, this.mySihuaGan);
				house.addStar(star, ZiWeiStarType.StarOtherBad.getCode());	
				this.starsHouseIndex.put(starname, i);
			}
		}
	}
	
	private void setupStarsBosi() {
		int lucunidx = this.starsHouseIndex.get("禄存");
		if(this.isClockwise()) {
			for(int i=0; i<ZiWeiHelper.StarsBosi.length; i++) {
				String starname = ZiWeiHelper.StarsBosi[i];
				int houseidx = (i + lucunidx) % 12;
				String housezi = this.houses[houseidx].ganzi.substring(1);
				ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
				this.houses[houseidx].addStar(star, ZiWeiStarType.StarSmall.getCode());
				this.starsHouseIndex.put("Y" + starname, houseidx);
			}
		}else {
			for(int i=0; i<ZiWeiHelper.StarsBosi.length; i++) {
				String starname = ZiWeiHelper.StarsBosi[i];
				int houseidx = (lucunidx - i + 24) % 12;
				String housezi = this.houses[houseidx].ganzi.substring(1);
				ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
				this.houses[houseidx].addStar(star, ZiWeiStarType.StarSmall.getCode());
				this.starsHouseIndex.put("Y" + starname, houseidx);
			}
		}
	}
	
	private void setupStarsTaiSui() {
		int yearidx = StemBranch.BranchIndex.get(this.yearZi);
		for(int i=0; i<this.houses.length; i++) {
			int idx = (i - yearidx + 24) % 12;
			String starname = ZiWeiHelper.StarsTaiSui[idx];
			String housezi = this.houses[i].ganzi.substring(1);
			ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, housezi, this.mySihua, this.mySihuaGan);
			this.houses[i].addStar(star, ZiWeiStarType.StarSmall.getCode());
			this.starsHouseIndex.put("Y" + starname, i);
		}
	}
	
	private void setupStarsJiang() {
		Map<String, String> map = ZiWeiHelper.StarsJiang.get(this.yearZi);
		for(Map.Entry<String, String> entry : map.entrySet()) {
			String starname = entry.getKey();
			String zi = entry.getValue();
			int houseidx = StemBranch.BranchIndex.get(zi);
			ZiWeiStar star = new ZiWeiStar(starname, this.yearGan, zi, this.mySihua, this.mySihuaGan);
			this.houses[houseidx].addStar(star, ZiWeiStarType.StarSmall.getCode());
			this.starsHouseIndex.put("Y" + starname, houseidx);
		}
	}
	
	private void setupSmallDirection() {
		for(int i=0; i<100; i++) {
			int idx = ZiWeiHelper.getSmallDirectioinHouse(i, this.yearZi, this.gender);
			this.houses[idx].addSmallDirection(i + 1);
		}
	}
	
	public static void main(String[] args) {
		String zone = "+08:00";
		String lon = "119e18";
		String lat = "26n06";
		String date = "1976-10-01 01:50";
		date = "2019-05-10 15:46";
		date = "1985-02-13 22:38:00";
//		lon = "120e18";
		
		int ad = 1;
		if(date.startsWith("-")) {
			ad = -1;
		}
		ZiWeiChart chart = new ZiWeiChart(ad, BaZiGender.Female, date, zone, lon, lat, false, null);
		
		String json = JsonUtility.encodePretty(chart);
		System.out.println(json);
	}
}
