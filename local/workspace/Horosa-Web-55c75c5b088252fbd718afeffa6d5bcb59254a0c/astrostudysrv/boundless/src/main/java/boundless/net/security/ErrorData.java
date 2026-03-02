package boundless.net.security;

import boundless.net.*;

public class ErrorData {
	private TcpChannel<PacketReader> _client;
	private int _errorCount = 0;
	private Object _lastValue;

	public TcpChannel<PacketReader> client() {
		return _client;
	}

	public void client(TcpChannel<PacketReader> value) {
		_client = value;
	}

	public int errorCount() {
		return _errorCount;
	}

	public void errorCount(int value) {
		_errorCount = value;
	}
	
	public Object lastValue(){
		return _lastValue;
	}
	
	public void lastValue(Object value){
		_lastValue=value;
	}
}
