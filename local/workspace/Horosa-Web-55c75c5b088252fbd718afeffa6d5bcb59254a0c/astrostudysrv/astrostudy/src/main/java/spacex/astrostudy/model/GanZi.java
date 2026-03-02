package spacex.astrostudy.model;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import boundless.types.Tuple;
import spacex.astrostudy.constants.FiveElement;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.constants.Polarity;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.GanZiRelativeHelper;
import spacex.astrostudy.helper.GodsHelper;
import spacex.astrostudy.helper.Gong12Helper;
import spacex.astrostudy.helper.WuXingPhaseHelper;
import spacex.astrostudy.model.GanZiCell;

public class GanZi {
	public Set<String> goodGods;
	public Set<String> badGods;
	public Set<String> neutralGods;

	public GanZiCell stem;
	public GanZiCell branch;
	public GanZiCell[] stemInBranch;
	
	public String ganzi;
	public String naying;
	public FiveElement nayingElement;
	public String ganziPhase;
	public String nayingPhase;
	public String zhu;
	public String xunEmpty;
	
	public Map<String, Object> gua64;
	public Map<String, Object> huGuaUp;
	public Map<String, Object> huGuaDown;
	public Map<String, Object> huGua;
	public Map<String, Object> tongGua;
	
	
	public Map<String, Object> starCharger; // 十二串宫中的值年星宿
	public Map<String, Object> zhiStarGod;
	
	
	public GanZi(String ganzi, PhaseType phaseType) {
		this(ganzi.substring(0, 1), ganzi.substring(1), phaseType);
	}
	
	public GanZi(String gan, String zi, PhaseType phaseType) {
		this.ganzi = gan + zi;		
		this.stem = new GanZiCell(gan, StemBranch.getStemElem(gan), StemBranch.getStemPolar(gan));
		this.branch = new GanZiCell(zi, StemBranch.getBranchElem(zi), StemBranch.getBranchPolar(zi));
		String[] stems = StemBranch.getStems(zi);
		this.stemInBranch = new GanZiCell[stems.length];
		for(int i=0; i<stems.length; i++) {
			this.stemInBranch[i] = new GanZiCell(stems[i], StemBranch.getStemElem(stems[i]), StemBranch.getStemPolar(stems[i]));
		}
		this.naying = StemBranch.getNaYing(this.ganzi);
		this.nayingElement = StemBranch.getNaYingElement(this.ganzi);
		
		this.ganziPhase = WuXingPhaseHelper.getPhase(phaseType, stem.cell, branch.cell);
		this.nayingPhase = WuXingPhaseHelper.getNaYinPhase(nayingElement, branch.cell);
		
		this.goodGods = new HashSet<String>();
		this.badGods = new HashSet<String>();
		this.neutralGods = new HashSet<String>();
		
		this.zhiStarGod = Gong12Helper.getGod(zi);
	}
	
	public void fillRela(String riyuan) {
		FiveElement riyuanFvelem = StemBranch.getStemElem(riyuan);
		Polarity riyuanPolar = StemBranch.getStemPolar(riyuan);

		this.stem.fillRelative(riyuanFvelem, riyuanPolar);
		this.branch.fillRelative(riyuanFvelem, riyuanPolar);
		
		for(GanZiCell gan : this.stemInBranch) {
			gan.fillRelative(riyuanFvelem, riyuanPolar);
		}
	}
	
	public void setRiYuan() {
		this.stem.relative = "日元";
	}
	
	
	public String ganCong(GanZi ganzi) {
		Tuple<Set<String>, String> tuple = GanZiRelativeHelper.gancong.get(this.stem.cell);
		if(tuple == null) {
			return null;
		}
		boolean flag = tuple.item1().contains(ganzi.stem.cell);
		if(flag) {
			return tuple.item2();
		}
		return null;
	}
	
	public String ziCong(GanZi ganzi) {
		Tuple<Set<String>, String> tuple = GanZiRelativeHelper.zicong.get(this.branch.cell);
		if(tuple == null) {
			return null;
		}
		boolean flag = tuple.item1().contains(ganzi.branch.cell);
		if(flag) {
			return tuple.item2();
		}
		return null;
	}
	
	public String ziXin(GanZi ganzi) {
		Tuple<Set<String>, String> tuple = GanZiRelativeHelper.zixin.get(this.branch.cell);
		if(tuple == null) {
			return null;
		}
		boolean flag = tuple.item1().contains(ganzi.branch.cell);
		if(flag) {
			return tuple.item2();
		}
		return null;
	}
	
	public String ziCuan(GanZi ganzi) {
		Tuple<Set<String>, String> tuple = GanZiRelativeHelper.zicuan.get(this.branch.cell);
		if(tuple == null) {
			return null;
		}
		boolean flag = tuple.item1().contains(ganzi.branch.cell);
		if(flag) {
			return tuple.item2();
		}
		return null;
	}
	
	public String ziPo(GanZi ganzi) {
		Tuple<Set<String>, String> tuple = GanZiRelativeHelper.zipo.get(this.branch.cell);
		if(tuple == null) {
			return null;
		}
		boolean flag = tuple.item1().contains(ganzi.branch.cell);
		if(flag) {
			return tuple.item2();
		}
		return null;
	}
	
	public String ganHe(GanZi ganzi) {
		Tuple<Set<String>, String> tuple = GanZiRelativeHelper.ganhe.get(this.stem.cell);
		if(tuple == null) {
			return null;
		}
		boolean flag = tuple.item1().contains(ganzi.stem.cell);
		if(flag) {
			return tuple.item2();
		}
		return null;
	}
	
	public String ziHe6(GanZi ganzi) {
		Tuple<Set<String>, String> tuple = GanZiRelativeHelper.zihe6.get(this.branch.cell);
		if(tuple == null) {
			return null;
		}
		boolean flag = tuple.item1().contains(ganzi.branch.cell);
		if(flag) {
			return tuple.item2();
		}
		return null;
	}
	
	public String ziHe3(GanZi ganzi) {
		Tuple<Set<String>, String> tuple = GanZiRelativeHelper.zihe3.get(this.branch.cell);
		if(tuple == null) {
			return null;
		}
		boolean flag = tuple.item1().contains(ganzi.branch.cell);
		if(flag) {
			return tuple.item2();
		}
		return null;
	}
	
	public String ziHui(GanZi ganzi) {
		Tuple<Set<String>, String> tuple = GanZiRelativeHelper.zihui.get(this.branch.cell);
		if(tuple == null) {
			return null;
		}
		boolean flag = tuple.item1().contains(ganzi.branch.cell);
		if(flag) {
			return tuple.item2();
		}
		return null;
	}
	
	public boolean ganTong(GanZi ganzi) {
		return this.stem.cell.equals(ganzi.stem.cell);
	}
	
	public boolean ziTong(GanZi ganzi) {
		return this.branch.cell.equals(ganzi.branch.cell);
	}
	
	@Override
	public boolean equals(Object obj) {
		GanZi ganzi = (GanZi) obj;
		return this.ganTong(ganzi) && this.ziTong(ganzi);
	}
	
	public void addGoodGod(String god) {
		this.goodGods.add(god);
	}
	
	public void addBadGod(String god) {
		this.badGods.add(god);
	}
	
	public void addNeutralGod(String god) {
		this.neutralGods.add(god);
	}
	
	public void findGods(GanZi keygz, int yearZiIdx) {
		GodsHelper.findGods(this, keygz, yearZiIdx);
	}
	
	public void setupStarCharger(String mingzhi) {
		String yzhi = this.branch.cell;
		this.starCharger = Gong12Helper.getYearCharger(yzhi, mingzhi);
	}
	
	public void setupGanGua(Map<String, Object> gua) {
		stem.gua = gua;
	}

	public void setupZhiGua(Map<String, Object> gua) {
		branch.gua = gua;
	}

	@Override
	public String toString() {
		return this.ganzi;
	}
}
