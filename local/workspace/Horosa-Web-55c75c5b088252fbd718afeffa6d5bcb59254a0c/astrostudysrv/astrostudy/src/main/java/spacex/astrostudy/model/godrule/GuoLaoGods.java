package spacex.astrostudy.model.godrule;

import java.util.HashMap;
import java.util.Map;

import spacex.astrostudy.constants.StemBranch;

public class GuoLaoGods {
	private Map<String, GuoLaoZiGods> ziGods = new HashMap<String, GuoLaoZiGods>();
	
	public GuoLaoGods() {
		for(int i=0; i<StemBranch.Branches.length; i++) {
			GuoLaoZiGods gods = new GuoLaoZiGods(StemBranch.Branches[i]);
			ziGods.put(StemBranch.Branches[i], gods);
		}
	}
	
	public void addGoodGod(String zi, String god) {
		GuoLaoZiGods gods = ziGods.get(zi);
		gods.goodGods.add(god);
	}
	
	public void addBadGod(String zi, String god) {
		GuoLaoZiGods gods = ziGods.get(zi);
		gods.badGods.add(god);
	}
	
	public void addNeutralGod(String zi, String god) {
		GuoLaoZiGods gods = ziGods.get(zi);
		gods.neutralGods.add(god);
	}
	
	public void addTaiSuiGod(String zi, String god, int idx) {
		GuoLaoZiGods gods = ziGods.get(zi);
		gods.taisuiGods[idx] = god;
	}
	
	
}
