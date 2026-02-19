package boundless.net.opc;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.function.Consumer;

import org.jinterop.dcom.core.IJIUnsigned;
import org.jinterop.dcom.core.JIString;
import org.jinterop.dcom.core.JIVariant;
import org.openscada.opc.lib.common.ConnectionInformation;
import org.openscada.opc.lib.da.AccessBase;
import org.openscada.opc.lib.da.AccessStateListener;
import org.openscada.opc.lib.da.Item;
import org.openscada.opc.lib.da.ItemState;
import org.openscada.opc.lib.da.Server;
import org.openscada.opc.lib.da.SyncAccess;
import org.openscada.opc.lib.da.browser.FlatBrowser;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class OpcCollector implements AccessStateListener{
	
	public static Object toJavaObject(JIVariant val){
		try{
			Object obj = val.getObject();
			String clazz = obj.getClass().getName();
			if(clazz.startsWith("java.lang.")){
				return obj;
			}
			
			if(obj instanceof JIString){
				JIString str = (JIString)obj;
				return str.getString();
			}
			
			if(obj instanceof IJIUnsigned){
				IJIUnsigned n = (IJIUnsigned) obj;
				return n.getValue();
			}
			return JsonUtility.encode(obj);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
		
	}
	
	private ConnectionInformation connectInfo;
	private Server server;
	private AccessBase access = null;
	private int period;
	private boolean errorOccured = false;
	
	private Consumer<Throwable> errorHandler;
	
	private Map<String, OpcItem> items = new ConcurrentHashMap<String, OpcItem>();
	
	public OpcCollector(String ip, String user, String pwd, String clsid, int periodInMs){
		this.period = periodInMs;
		connectInfo = new ConnectionInformation();
		connectInfo.setHost(ip);
		connectInfo.setDomain("");
		connectInfo.setUser(user);
		connectInfo.setPassword(pwd);
		connectInfo.setClsid(clsid); 
	}
	
	public void setPeriod(int period){
		this.period = period;
	}
	
	public void setErrorHandler(Consumer<Throwable> errorHandler) {
		this.errorHandler = errorHandler;
	}

	public synchronized void start(){
		if(this.server == null){
			try{
				server = new Server(connectInfo, new ScheduledThreadPoolExecutor(1));
				server.connect();
			}catch(Exception e){
				if(server != null){
					try{
						server.disconnect();
					}catch(Exception err){
						
					}
					server = null;
				}
				throw new RuntimeException(e);
			}
		}
		
		if(this.access != null){
			return;
		}
		
		try {
			this.access = new SyncAccess(server, this.period);
			this.access.addStateListener(this);
			
			final FlatBrowser flatBrowser = server.getFlatBrowser();
			Collection<String> itemids = flatBrowser.browse("");
			if(flatBrowser != null){
				for(final String item : itemids){
					access.addItem(item, (itm, state)->receivedItem(itm, state));
				}
			}
			
			access.bind();

		} catch (Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			shutdown();
		}
	}
	
	@Override
	public synchronized void stateChanged(boolean state) {
		if(errorOccured && !state){
			try{
				QueueLog.error(AppLoggers.ErrorLogger, "some error occured, opc server connection will shutdown");
				shutdown();
				Thread.sleep(10000);
				errorOccured = false;
			}catch(Exception e){
			}
		}
	}

	@Override
	public synchronized void errorOccured(Throwable t) {
		QueueLog.error(AppLoggers.ErrorLogger, t);
		errorOccured = true;
		if(errorHandler != null){
			try{
				errorHandler.accept(t);
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
	}
		
	private void receivedItem(Item item, ItemState itemState){
		try{
			String id = item.getId();
			OpcItem itm = items.get(id);
			if(itm == null){
				itm = new OpcItem();
				items.put(id, itm);
			}
			JIVariant val = itemState.getValue();
			int type = val.getType();
			String hex = StringUtility.toHex(type, true);
			itm.value = OpcCollector.toJavaObject(val);
			itm.errorCode = itemState.getErrorCode();
			itm.time = itemState.getTimestamp().getTime();
			itm.quality = itemState.getQuality();
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		
	}
	
	public boolean isConnected(){
		return this.server != null && this.access != null;
	}
	
	public Map<String, OpcItem> getItems(){
		return items;
	}
	

	public void shutdown(){
		try{
			if(access != null){
				access.unbind();
			}
		}catch(Exception err){
		}
		access = null;
		
		try{
			server.disconnect();
		}catch(Exception e){
			
		}
		server = null;
		
	}
	
}
