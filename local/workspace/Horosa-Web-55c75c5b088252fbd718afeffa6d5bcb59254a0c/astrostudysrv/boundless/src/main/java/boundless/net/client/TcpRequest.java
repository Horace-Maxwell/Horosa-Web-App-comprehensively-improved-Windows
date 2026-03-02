package boundless.net.client;

import java.io.IOException;
import java.util.Hashtable;

import boundless.types.*;
import boundless.net.*;

class TcpRequest {
	private TcpClient _client;
	private ResponseIdPool _resposeIdPool = new ResponseIdPool();
	private Hashtable<Integer, Hashtable<Short, RequestItem>> _callbackDic = new Hashtable<Integer, Hashtable<Short, RequestItem>>();

	private long _timeout = 30000L; // timeout in millisecond
	private boolean _requestSuccess = false;
	
	public TcpRequest(TcpClient client) {
		this._client = client;
		client.addListener(new PacketListener());
	}

	public TcpRequest(TcpClient client, long timeout) {
		this(client);
		this._timeout = timeout;
	}
	
	/**
	 * set the default timeout in millisecond
	 * @param timeout
	 */
	public void setTimeout(long timeout){
		this._timeout = timeout;
	}
	
	/**
	 * get the default timeout in millisecond
	 * @return
	 */
	public long getTimeout(){
		return this._timeout;
	}
	
	private void removeCallbackEntry(Integer packId, Short responseId){
		synchronized (_callbackDic){
			Hashtable<Short, RequestItem> ht = _callbackDic.get(packId);
			if(ht == null){
				return;
			}
			ht.remove(responseId);
			_callbackDic.remove(packId);
		}
	}

	/**
	 * send a PacketWriter object as request package to server synchronously
	 * @param pw a PacketWriter object as request package
	 * @return a PacketWriter object as response package from server
	 * @throws IOException some sending exception or default timeout(30 sec)
	 */
	public PacketReader send(PacketWriter pw) throws IOException {
		return send(pw, _timeout);
	}

	/**
	 * send a PacketWriter object as request package to server synchronously
	 * @param pw a PacketWriter object as request package
	 * @param timeout the specified timeout for this request
	 * @return a PacketWriter object as response package from server
	 * @throws IOException some sending exception or timeout
	 */
	public PacketReader send(PacketWriter pw, long timeout) throws IOException {
		RequestItem item = new RequestItem(pw);
		Integer intKey = Integer.valueOf(pw.packetId());
		synchronized (_callbackDic) {
			Hashtable<Short, RequestItem> ht = _callbackDic.get(intKey);
			if (ht == null) {
				ht = new Hashtable<Short, RequestItem>();
				_callbackDic.put(intKey, ht);
			}
			ht.put(new Short(pw.responseId()), item);
		}

		return item.send(timeout);
	}

	private class PacketListener implements IPacketEventListener {

		@Override
		public int getAttentionId() {
			return -1;
		}

		@Override
		public void recevie(PacketEvent e) {
			PacketReader reader = e.reader();
			if (reader.packetType() != PacketType.RESPONSE)
				return;

			Integer intKey = Integer.valueOf(reader.packetId());
			synchronized (_callbackDic) {
				Hashtable<Short, RequestItem> ht = _callbackDic.get(intKey);
				if (ht == null)
					return;
				RequestItem item = ht.remove(new Short(reader.responseId()));
				if (item != null)
					item.receive(reader);
			}
		}
	}

	private class RequestItem {
		private Object _mo = new Object();
		private PacketWriter _pw;
		private PacketReader _rspReader;

		public RequestItem(PacketWriter pw) {
			this._pw = pw;
			pw.packetType(PacketType.REQUEST);
			this._pw.responseId(_resposeIdPool.getResponseId());
		}
		
		public PacketReader send(long timeout) throws IOException{
			synchronized (_mo) {
				_client.send(_pw);
				_requestSuccess = false;
				try {
					_mo.wait(timeout);
				} catch (InterruptedException e) {
					throw new IOException(e.toString());
				}
				
				if(!_requestSuccess){
					Integer packId = Integer.valueOf(_pw.packetId());
					Short responseId = Short.valueOf(_pw.responseId());
					removeCallbackEntry(packId, responseId);
					throw new IOException("request.timeout");
				}
			}

			_resposeIdPool.putbackResponseId(_pw.responseId());
			return _rspReader;
		}

		public void receive(PacketReader reader) {
			synchronized (_mo) {
				_rspReader = reader;
				_requestSuccess = true;
				_mo.notify();
			}
		}
	}

	/**
	 * 响应代码池
	 * 
	 * @author Administrator
	 * 
	 */
	private class ResponseIdPool {
		private ConcurrentIntPool _valPool = new ConcurrentIntPool((short) 1000);

		public short getResponseId() {
			return (short) _valPool.getValue();
		}

		public void putbackResponseId(short responseId) {
			_valPool.putback(responseId);
		}
	}
	
}
