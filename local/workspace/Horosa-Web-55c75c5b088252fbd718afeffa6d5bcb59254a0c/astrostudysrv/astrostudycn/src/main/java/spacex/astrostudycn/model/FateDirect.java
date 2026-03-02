package spacex.astrostudycn.model;

import java.util.Map;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.helper.BaZiHelper;
import spacex.astrostudy.helper.Gong12Helper;
import spacex.astrostudy.model.GanZi;

public class FateDirect {
	public int age;
	public int startYear;
	public GanZi mainDirect;
	public GanZi[] subDirect = new GanZi[10];
	public Map<String, Object>[] gong12God = new Map[10];
	public Map<String, Object> gong12GodDirect = null;
	
	private transient BaZi parent;
	
	public FateDirect(int age, int startYear, String maindirGanzi, String riyuan, PhaseType phaseType, BaZi parent) {
		this.age = age;
		this.startYear = startYear;
		this.parent = parent;
		this.mainDirect = new GanZi(maindirGanzi, phaseType);
		this.mainDirect.fillRela(riyuan);
		
		for(int i=0; i<10; i++) {
			int year = startYear + i;
			String ganzi = BaZiHelper.getYearGanzi(year);
			subDirect[i] = new GanZi(ganzi, phaseType);
			subDirect[i].fillRela(riyuan);
		}
	}
	
	public void findGods(GanZi keygz, int yearZiIdx) {
		this.mainDirect.findGods(keygz, yearZiIdx);
		for(GanZi gz : subDirect) {
			gz.findGods(keygz, yearZiIdx);
		}
	}
	
	public void fillRela(String riyuan) {
		this.mainDirect.fillRela(riyuan);
		for(GanZi gz : subDirect) {
			gz.fillRela(riyuan);
		}
	}
	
	public void setupYearCharger(String mingzhi) {
		for(int i=0; i<10; i++) {
			subDirect[i].setupStarCharger(mingzhi);
		}
	}
	
	public void setupGong12() {
		if(this.parent == null) {
			return;
		}
		
		String yzi = this.mainDirect.branch.cell;
		String dayun = this.mainDirect.ganzi;
		this.gong12GodDirect = Gong12Helper.getLiuNianGong12(yzi, dayun, this.parent.fourColumns);

		for(int i=0; i<10; i++) {
			GanZi ganzi = subDirect[i];
			String yearzi = ganzi.branch.cell;
			Map<String, Object> stargod = Gong12Helper.getLiuNianGong12(yearzi, dayun, this.parent.fourColumns);
			gong12God[i] = stargod;
		}
	}
	
}
