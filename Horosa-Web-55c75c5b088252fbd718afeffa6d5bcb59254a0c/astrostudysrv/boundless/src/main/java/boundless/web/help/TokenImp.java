package boundless.web.help;

public class TokenImp implements Token {
	
	private String uniqueId;
	private long accessDate;
	
	public TokenImp(){ }
	
	public TokenImp(String s, long t){
		uniqueId = s;
		accessDate = t;
	}

	@Override
	public void accessDate(long t) {
		accessDate = t;
	}

	@Override
	public long accessDate() {
		return accessDate;
	}

	@Override
	public void uniqueId(String s) {
		uniqueId = s;
	}

	@Override
	public String uniqueId() {
		return uniqueId;
	}

}
