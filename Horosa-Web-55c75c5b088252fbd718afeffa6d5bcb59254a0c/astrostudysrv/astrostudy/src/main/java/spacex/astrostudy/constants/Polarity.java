package spacex.astrostudy.constants;

public enum Polarity {
	Positive(1), Negative(0);
	
	private int code;
	private Polarity(int c) {
		this.code = c;
	}
	
	public int getCode() {
		return this.code;
	}
	
	@Override
	public String toString() {
		return this.code == 1 ? "阳" : "阴";
	}

}
