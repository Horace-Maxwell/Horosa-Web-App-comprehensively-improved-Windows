package boundless.types;

public class TimeSpan {
	private long ms;
	
	public TimeSpan(long ms){
		this.ms = ms;
	}
	
	public long totalDays(){
		return  this.ms / 86400000;
	}
	
	public static long getTotalDays(long ms){
		return ms / 86400000;
	}
	
}
