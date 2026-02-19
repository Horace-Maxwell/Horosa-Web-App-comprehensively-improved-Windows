package boundless.types;

public enum FileMode {
	CreateNew(0),
	Create(1),
	Open(2),
	OpenOrCreate(3),
	Truncate(4),
	Append(5);
	
	private int _code;
	
	private FileMode(int code){
		_code = code;
	}
	
	public int getCode(){
		return _code;
	}
	
}
