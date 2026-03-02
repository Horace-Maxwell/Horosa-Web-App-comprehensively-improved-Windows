package boundless.types.message;


abstract public class Messager {
	public String host;
	public int port;
	public String username;
	public String password;
	public int timeout;
	public String dest;
	public String signature;
		
	private boolean _hasNotified = false;
	
	abstract protected void doSend(String msg) throws Exception;
	abstract protected void doSend(String title, String msg) throws Exception;
	
	public void send(String msg){
		if(_hasNotified){
			return;
		}
		try{
			doSend(msg);
			_hasNotified = true;			
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public void send(String title, String msg){
		if(_hasNotified){
			return;
		}
		try{
			doSend(title, msg);
			_hasNotified = true;			
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public void reset(){
		_hasNotified = false;
	}
}
