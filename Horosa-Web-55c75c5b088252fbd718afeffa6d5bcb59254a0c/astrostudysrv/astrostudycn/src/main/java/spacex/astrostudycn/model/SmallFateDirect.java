package spacex.astrostudycn.model;

import java.util.HashMap;
import java.util.Map;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.Gong12Helper;
import spacex.astrostudy.model.GanZi;

public class SmallFateDirect {
	public int age;
	public int year;
	public GanZi direct;
	public GanZi yearGanzi;
	
	public Map<String, Object> gong12God;
	public Map<String, Object> gong12GodDirect = new HashMap<String, Object>();
	
	private transient BaZi parent;
	
	public SmallFateDirect(int age, int year, int yearJiaziIndex, String directGanzi, String riyuan, PhaseType phaseType, BaZi parent) {
		this.age = age;
		this.year = year;
		this.parent = parent;
		this.direct = new GanZi(directGanzi, phaseType);
		this.direct.fillRela(riyuan);
		
		String yganzi = StemBranch.JiaZi[yearJiaziIndex];
		this.yearGanzi = new GanZi(yganzi, phaseType);
		this.yearGanzi.fillRela(riyuan);
	}
	
	public void findGods(GanZi keygz, int yearZiIdx) {
		this.direct.findGods(keygz, yearZiIdx);
		this.yearGanzi.findGods(keygz, yearZiIdx);
	}
	
	public void fillRela(String riyuan) {
		this.direct.fillRela(riyuan);
		this.yearGanzi.fillRela(riyuan);
	}
	
	public void setupGong12() {
		if(this.parent == null) {
			return;
		}
		
		String dayun = this.direct.ganzi;
		String yearzi = yearGanzi.branch.cell;
		String yzi = this.direct.branch.cell;
		this.gong12GodDirect = Gong12Helper.getLiuNianGong12(yzi, dayun, this.parent.fourColumns);
		this.gong12God = Gong12Helper.getLiuNianGong12(yearzi, dayun, this.parent.fourColumns);
	}

}
