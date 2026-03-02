package spacex.astrostudy.constants;


public enum FiveElement {
	Earth(0), Metal(1), Water(2), Wood(3), Fire(4);
	
	private int code;
	private FiveElement(int c) {
		this.code = c;
	}
	
	public int getCode() {
		return this.code;
	}
	
	@Override
	public String toString() {
		if(this == Metal) {
			return "金";
		}else if(this == Wood) {
			return "木";
		}else if(this == Water) {
			return "水";
		}else if(this == Fire) {
			return "火";
		}else {
			return "土";
		}
	}
	
	public String getRelative(FiveElement elem, boolean samePolar) {
		if(this == elem) {
			if(samePolar) {
				return "比";
			}
			return "劫";
		}
		
		int c = (this.getCode() + 1) % 5;
		if(c == elem.getCode()) {
			if(samePolar) {
				return "枭";
			}
			return "印";
		}
		
		c = (this.getCode() + 2) % 5;
		if(c == elem.getCode()) {
			if(samePolar) {
				return "杀";
			}
			return "官";
		}
		
		c = (this.getCode() + 3) % 5;
		if(c == elem.getCode()) {
			if(samePolar) {
				return "才";
			}
			return "财";
		}
		
		c = (this.getCode() + 4) % 5;
		if(c == elem.getCode()) {
			if(samePolar) {
				return "食";
			}
		}
		return "伤";
	}
	
	public static FiveElement fromCode(String str) {
		if(str.equalsIgnoreCase("土") || str.equalsIgnoreCase("Earth")) {
			return Earth;
		}
		if(str.equalsIgnoreCase("金") || str.equalsIgnoreCase("Metal")) {
			return Metal;
		}
		if(str.equalsIgnoreCase("水") || str.equalsIgnoreCase("Water")) {
			return Water;
		}
		if(str.equalsIgnoreCase("木") || str.equalsIgnoreCase("Wood")) {
			return Wood;
		}
		if(str.equalsIgnoreCase("火") || str.equalsIgnoreCase("Fire")) {
			return Fire;
		}
		
		throw new RuntimeException("no.five.element");
	}

}
