package spacex.astrostudy.model.godrule;

import java.util.HashSet;
import java.util.Set;

public class GuoLaoZiGods {
	public String zi;
	public Set<String> goodGods;
	public Set<String> badGods;
	public Set<String> neutralGods;
	public String[] taisuiGods;
	
	public GuoLaoZiGods(String zi) {
		this.zi = zi;
		this.goodGods = new HashSet<String>();
		this.badGods = new HashSet<String>();
		this.neutralGods = new HashSet<String>();
		this.taisuiGods = new String[] {"", "", ""};
	}
	
}
