package spacex.astrostudy.model;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.GodsHelper;
import spacex.astrostudy.helper.Gong12Helper;
import spacex.astrostudy.model.godrule.GuoLaoGods;

public class FourColumns {
	public static final class Item{
		public String zhu;
		public String cell;
		
		public Item(String zhu, String cell) {
			this.zhu = zhu;
			this.cell = cell;
		}
		
		@Override
		public boolean equals(Object obj) {
			Item item = (Item) obj;
			if(zhu == null || cell == null || item == null || item.zhu == null || item.cell == null) {
				return false;
			}
			return this.zhu.equals(item.zhu) && cell.equals(item.cell);
		}
		
		@Override
		public int hashCode() {
			int code = this.zhu.hashCode() * this.cell.hashCode();
			return code;
		}
	}
	
	public transient PhaseType phaseType = PhaseType.HuoTu;
	public transient GanZi[] fourZhu = new GanZi[7];
	public transient Map<String, GanZi> fourZhuMap = new HashMap<String, GanZi>();
	
	public GanZi year;
	public GanZi month;
	public GanZi day;
	public GanZi time;
	
	public GanZi tai;
	public GanZi ming;
	public GanZi shen;
	
	public Map<String, Object> ming12; // 十二串宫的命宫
	
	public Map<String, Set<Item>> ganHe = new HashMap<String, Set<Item>>();
	public Map<String, Set<Item>> ganCong = new HashMap<String, Set<Item>>();
	public Map<String, Set<Item>> ziCong = new HashMap<String, Set<Item>>();
	public Map<String, Set<Item>> ziHe6 = new HashMap<String, Set<Item>>();
	public Map<String, Set<Item>> ziHe3 = new HashMap<String, Set<Item>>();
	public Map<String, Set<Item>> ziHui = new HashMap<String, Set<Item>>();
	public Map<String, Set<Item>> ziXing = new HashMap<String, Set<Item>>();
	public Map<String, Set<Item>> ziCuan = new HashMap<String, Set<Item>>();
	public Map<String, Set<Item>> ziPo = new HashMap<String, Set<Item>>();
	
	public GuoLaoGods guolaoGods;
	
	public void fillRelative() {
		String riyuan = this.day.stem.cell;
		this.year.fillRela(riyuan);
		this.month.fillRela(riyuan);
		this.day.fillRela(riyuan);
		this.time.fillRela(riyuan);
		
		this.day.setRiYuan();
	}
	
	public void setupThreeSpec(PhaseType phaseType, Map<String, Object> sunInfo, Map<String, Object> moonInfo) {
		this.phaseType = phaseType;
		setupTai(phaseType);
		setupMing(phaseType, sunInfo);
		setupSheng(phaseType, sunInfo);
		setupMing12();
		
		this.year.zhu = "年";
		this.month.zhu = "月";
		this.day.zhu = "日";
		this.time.zhu = "时";
		this.tai.zhu = "胎";
		this.ming.zhu = "命";
		this.shen.zhu = "身";
		
		fourZhu[0] = this.year;
		fourZhu[1] = this.month;
		fourZhu[2] = this.day;
		fourZhu[3] = this.time;
		fourZhu[4] = this.tai;
		fourZhu[5] = this.ming;
		fourZhu[6] = this.shen;
		
		fourZhuMap.put("年", this.year);
		fourZhuMap.put("月", this.month);
		fourZhuMap.put("日", this.day);
		fourZhuMap.put("时", this.time);
		fourZhuMap.put("胎", this.tai);
		fourZhuMap.put("命", this.ming);
		fourZhuMap.put("身", this.shen);
		
		for(GanZi gz : fourZhu) {
			gz.xunEmpty = StemBranch.getXunEmpty(gz.ganzi);
		}
		
	}
	
	public Map<String, Object> setupGong12() {
		Map<String, Object> res = new HashMap<String, Object>();
		
		String gan = this.day.stem.cell;
		String yearZi = Gong12Helper.ganTongZi(gan);
		Map<String, Object> year = Gong12Helper.getLiuNianGong12(yearZi, this.year.stem.cell, this.year.branch.cell);
		Map<String, Object> month = Gong12Helper.getLiuNianGong12(yearZi, this.month.stem.cell, this.month.branch.cell);
		Map<String, Object> day = Gong12Helper.getLiuNianGong12(yearZi, this.day.stem.cell, this.day.branch.cell);
		Map<String, Object> time = Gong12Helper.getLiuNianGong12(yearZi, this.time.stem.cell, this.time.branch.cell);
		Map<String, Object> tai = Gong12Helper.getLiuNianGong12(yearZi, this.tai.stem.cell, this.tai.branch.cell);
		Map<String, Object> ming = Gong12Helper.getLiuNianGong12(yearZi, this.ming.stem.cell, this.ming.branch.cell);
		Map<String, Object> sheng = Gong12Helper.getLiuNianGong12(yearZi, this.shen.stem.cell, this.shen.branch.cell);

		res.put("年", year);
		res.put("月", month);
		res.put("日", day);
		res.put("时", time);
		res.put("胎", tai);
		res.put("命", ming);
		res.put("身", sheng);
		
		return res;
	}
	
	private void setupTai(PhaseType phaseType) {
		int taiganIdx = StemBranch.StemIndex.get(this.month.stem.cell);
		int taiziIdx = StemBranch.BranchIndex.get(this.month.branch.cell);
		String taigan = StemBranch.Stems[(taiganIdx + 1) % 10];
		String taizi = StemBranch.Branches[(taiziIdx + 3) % 12];
		this.tai = new GanZi(taigan, taizi, phaseType);
		this.tai.fillRela(this.day.stem.cell);
	}
	
	private void setupMing(PhaseType phaseType, Map<String, Object> sunInfo) {
		int nongliMonth = StemBranch.ZiMonth.get(this.month.branch.cell);
		int sunMonth = StemBranch.SigSunMonth.get(StemBranch.SignZi.get(sunInfo.get("sign")));
		int mdelta = sunMonth - nongliMonth;
		int mziIdx = 13 - nongliMonth;
		int tmidx = StemBranch.BranchIndex.get(this.time.branch.cell);
		int n = (3 - tmidx + 12) % 12; // 3为卯的index
		int ziIdx = (mziIdx + n) % 12;
		String zi = StemBranch.Branches[ziIdx];
		
		int delta = StemBranch.ZiMonth.get(zi) - nongliMonth;
		int ganidx = (StemBranch.StemIndex.get(this.month.stem.cell) + delta + 10) % 10;
		String gan = StemBranch.Stems[ganidx];
		this.ming = new GanZi(gan, zi, phaseType);
		
		this.ming.fillRela(this.day.stem.cell);
	}
	
	private void setupSheng(PhaseType phaseType, Map<String, Object> sunInfo) {
		int nongliMonth = StemBranch.ZiMonth.get(this.month.branch.cell);
		int sunMonth = StemBranch.SigSunMonthInv.get(StemBranch.SignZi.get(sunInfo.get("sign")));
		int mdelta = sunMonth - nongliMonth;
		int mziIdx = (nongliMonth - 1) % 12;
		int tmidx = StemBranch.BranchIndex.get(this.time.branch.cell);
		int n = (tmidx - 9 + 12) % 12;  // // 9为酉的index
		int ziIdx = (mziIdx - n + 12) % 12;
		String zi = StemBranch.Branches[ziIdx];
		
		int delta = StemBranch.ZiMonth.get(zi) - nongliMonth;
		int ganidx = (StemBranch.StemIndex.get(this.month.stem.cell) + delta + 10) % 10;
		String gan = StemBranch.Stems[ganidx];
		this.shen = new GanZi(gan, zi, phaseType);
		
		this.shen.fillRela(this.day.stem.cell);
		
	}
	
	private void setupMing12() {
		String mzhi = this.month.branch.cell;
		String tzhi = this.time.branch.cell;
		this.ming12 = Gong12Helper.getMing(mzhi, tzhi);
	}
		
	public void setupGanZiTransform() {
		setupGanHe();
		setupGanCong();
		setupZiHe6();
		setupZiHe3();
		setupZiHui();
		setupZiXin();
		setupZiCong();
		setupZiCuan();
		setupZiPo();
		setupGuoLaoGods();
	}
	
	private void setupGanHe() {
		for(int i=0; i<4; i++) {
			GanZi gz0 = this.fourZhu[i];
			for(int j=0; j<4; j++) {
				if(i == j) {
					continue;
				}
				GanZi gz1 = this.fourZhu[j];
				String elem = gz0.ganHe(gz1);
				if(!StringUtility.isNullOrEmpty(elem)) {
					Set<Item> set = this.ganHe.get(elem);
					if(set == null) {
						set = new HashSet<Item>();
						this.ganHe.put(elem, set);
						Item itm = new Item(gz0.zhu, gz0.stem.cell);
						set.add(itm);
					}
					Item itm = new Item(gz1.zhu, gz1.stem.cell);
					set.add(itm);
				}
			}
		}
	}
	
	private void setupGanCong() {
		for(int i=0; i<4; i++) {
			GanZi gz0 = this.fourZhu[i];
			for(int j=0; j<4; j++) {
				if(i == j) {
					continue;
				}
				GanZi gz1 = this.fourZhu[j];
				String elem = gz0.ganCong(gz1);
				if(!StringUtility.isNullOrEmpty(elem)) {
					Set<Item> set = this.ganCong.get(elem);
					if(set == null) {
						set = new HashSet<Item>();
						this.ganCong.put(elem, set);
						Item itm = new Item(gz0.zhu, gz0.stem.cell);
						set.add(itm);
					}
					Item itm = new Item(gz1.zhu, gz1.stem.cell);
					set.add(itm);
				}
			}
		}
	}
	
	private void setupZiHe6() {
		for(int i=0; i<4; i++) {
			GanZi gz0 = this.fourZhu[i];
			for(int j=0; j<4; j++) {
				if(i == j) {
					continue;
				}
				GanZi gz1 = this.fourZhu[j];
				String elem = gz0.ziHe6(gz1);
				if(!StringUtility.isNullOrEmpty(elem)) {
					Set<Item> set = this.ziHe6.get(elem);
					if(set == null) {
						set = new HashSet<Item>();
						Item itm = new Item(gz0.zhu, gz0.branch.cell);
						this.ziHe6.put(elem, set);
						set.add(itm);
					}
					Item itm = new Item(gz1.zhu, gz1.branch.cell);
					set.add(itm);
				}
			}
		}
	}
	
	private void setupZiHe3() {
		for(int i=0; i<4; i++) {
			GanZi gz0 = this.fourZhu[i];
			for(int j=0; j<4; j++) {
				if(i == j) {
					continue;
				}
				GanZi gz1 = this.fourZhu[j];
				String elem = gz0.ziHe3(gz1);
				if(!StringUtility.isNullOrEmpty(elem)) {
					Set<Item> set = this.ziHe3.get(elem);
					if(set == null) {
						set = new HashSet<Item>();
						this.ziHe3.put(elem, set);
						Item itm = new Item(gz0.zhu, gz0.branch.cell);
						set.add(itm);
					}
					Item itm = new Item(gz1.zhu, gz1.branch.cell);
					set.add(itm);
				}
			}
		}
	}
	
	private void setupZiHui() {
		for(int i=0; i<4; i++) {
			GanZi gz0 = this.fourZhu[i];
			for(int j=0; j<4; j++) {
				if(i == j) {
					continue;
				}
				GanZi gz1 = this.fourZhu[j];
				String elem = gz0.ziHui(gz1);
				if(!StringUtility.isNullOrEmpty(elem)) {
					Set<Item> set = this.ziHui.get(elem);
					if(set == null) {
						set = new HashSet<Item>();
						this.ziHui.put(elem, set);
						Item itm = new Item(gz0.zhu, gz0.branch.cell);
						set.add(itm);
					}
					Item itm = new Item(gz1.zhu, gz1.branch.cell);
					set.add(itm);
				}
			}
		}
	}
	
	private void setupZiXin() {
		for(int i=0; i<4; i++) {
			GanZi gz0 = this.fourZhu[i];
			for(int j=0; j<4; j++) {
				if(i == j) {
					continue;
				}
				GanZi gz1 = this.fourZhu[j];
				String elem = gz0.ziXin(gz1);
				if(!StringUtility.isNullOrEmpty(elem)) {
					Set<Item> set = this.ziXing.get(elem);
					if(set == null) {
						set = new HashSet<Item>();
						Item itm = new Item(gz0.zhu, gz0.branch.cell);
						this.ziXing.put(elem, set);
						set.add(itm);
					}
					Item itm = new Item(gz1.zhu, gz1.branch.cell);
					set.add(itm);
				}
			}
		}
	}
	
	private void setupZiCong() {
		for(int i=0; i<4; i++) {
			GanZi gz0 = this.fourZhu[i];
			for(int j=0; j<4; j++) {
				if(i == j) {
					continue;
				}
				GanZi gz1 = this.fourZhu[j];
				String elem = gz0.ziCong(gz1);
				if(!StringUtility.isNullOrEmpty(elem)) {
					Set<Item> set = this.ziCong.get(elem);
					if(set == null) {
						set = new HashSet<Item>();
						Item itm = new Item(gz0.zhu, gz0.branch.cell);
						this.ziCong.put(elem, set);
						set.add(itm);
					}
					Item itm = new Item(gz1.zhu, gz1.branch.cell);
					set.add(itm);
				}
			}
		}		
	}
	
	private void setupZiCuan() {
		for(int i=0; i<4; i++) {
			GanZi gz0 = this.fourZhu[i];
			for(int j=0; j<4; j++) {
				if(i == j) {
					continue;
				}
				GanZi gz1 = this.fourZhu[j];
				String elem = gz0.ziCuan(gz1);
				if(!StringUtility.isNullOrEmpty(elem)) {
					Set<Item> set = this.ziCuan.get(elem);
					if(set == null) {
						set = new HashSet<Item>();
						Item itm = new Item(gz0.zhu, gz0.branch.cell);
						this.ziCuan.put(elem, set);
						set.add(itm);
					}
					Item itm = new Item(gz1.zhu, gz1.branch.cell);
					set.add(itm);
				}
			}
		}		
	}
	
	private void setupZiPo() {
		for(int i=0; i<4; i++) {
			GanZi gz0 = this.fourZhu[i];
			for(int j=0; j<4; j++) {
				if(i == j) {
					continue;
				}
				GanZi gz1 = this.fourZhu[j];
				String elem = gz0.ziPo(gz1);
				if(!StringUtility.isNullOrEmpty(elem)) {
					Set<Item> set = this.ziPo.get(elem);
					if(set == null) {
						set = new HashSet<Item>();
						Item itm = new Item(gz0.zhu, gz0.branch.cell);
						this.ziPo.put(elem, set);
						set.add(itm);
					}
					Item itm = new Item(gz1.zhu, gz1.branch.cell);
					set.add(itm);
				}
			}
		}		
	}
	
	private void setupGuoLaoGods() {
		this.guolaoGods = GodsHelper.findGuoLaoGods(this.year.stem.cell, this.year.branch.cell);
		GodsHelper.addDouShao(guolaoGods, this.month.branch.cell, this.time.branch.cell);
	}
	
}
