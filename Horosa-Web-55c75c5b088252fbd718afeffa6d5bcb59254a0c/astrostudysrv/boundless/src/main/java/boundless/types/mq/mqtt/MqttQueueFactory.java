package boundless.types.mq.mqtt;

import java.util.Properties;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocketFactory;

import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttClientPersistence;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

import boundless.exception.AppException;
import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.net.ssl.SSLUtility;
import boundless.types.mq.IMsgQueueFactory;
import boundless.types.mq.MsgQueue;
import boundless.utility.ConvertUtility;
import boundless.utility.ProgArgsHelper;
import boundless.utility.StringUtility;

public class MqttQueueFactory implements IMsgQueueFactory {
	private static Properties mqttProp;
	private static String clientId;
	private static String broker;
	private static MqttClientPersistence persistence;
	private static MqttConnectOptions connOpts;
	
	private static MqttClient client = null;
	
	public static void close(){
		if(client != null){
			try{
				client.disconnect();
			}catch(Exception e){
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
	}
	
	@Override
	public void build(String conffilepath) {
		close();
		try{
			mqttProp = FileUtility.getProperties(conffilepath);
			ProgArgsHelper.convertProperties(mqttProp, "mqtt.");

			String host = ConvertUtility.getValueAsString(mqttProp.getProperty("host"));
			String protocol = ConvertUtility.getValueAsString(mqttProp.getProperty("protocol"));
			int port = ConvertUtility.getValueAsInt(mqttProp.getProperty("port"));
			
			String persisClass = ConvertUtility.getValueAsString(mqttProp.getProperty("persistenceClass"));
			if(StringUtility.isNullOrEmpty(persisClass)) {
				persistence = new MemoryPersistence();
			}else {
				Class persis = Class.forName(persisClass);
				persistence = (MqttClientPersistence) persis.newInstance();				
			}
			
			clientId = ConvertUtility.getValueAsString(mqttProp.getProperty("clientId"));
			if(StringUtility.isNullOrEmpty(clientId) || "auto".equalsIgnoreCase(clientId)) {
				clientId = "srv_" + StringUtility.getUUID();
			}
			broker = String.format("%s://%s:%d", protocol, host, port);
			String username = ConvertUtility.getValueAsString(mqttProp.getProperty("username"));
			String password = ConvertUtility.getValueAsString(mqttProp.getProperty("password"));
			connOpts = new MqttConnectOptions();
			connOpts.setCleanSession(true);
			if(!StringUtility.isNullOrEmpty(username)) {
				connOpts.setUserName(username);				
			}
			if(!StringUtility.isNullOrEmpty(password)) {
				connOpts.setPassword(password.toCharArray());				
			}
			connOpts.setConnectionTimeout(10);
			connOpts.setKeepAliveInterval(20);
			connOpts.setAutomaticReconnect(true);
			HostnameVerifier hostnameVerifier = new HostnameVerifier(){
				@Override
				public boolean verify(String arg0, SSLSession arg1) {
					return true;
				}
			};
			connOpts.setSSLHostnameVerifier(hostnameVerifier);
			if(protocol.equalsIgnoreCase("ssl")){
				SSLSocketFactory fac = getSSLSocketFactory();
				if(fac != null){
					connOpts.setSocketFactory(fac);
				}
			}
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			e.printStackTrace();
			throw new RuntimeException(e);
		}
	}
	
	private SSLSocketFactory getSSLSocketFactoryFromCertStr(String castr, String certstr) throws Exception{
		byte[] caraw = castr.getBytes("utf-8");
		byte[] certraw = certstr.getBytes("utf-8");
		String sslver = mqttProp.getProperty("sslver");
		SSLSocketFactory fac = SSLUtility.getSocketFactory(caraw, certraw, null, null, sslver);
		return fac;
	}
	
	private SSLSocketFactory getSSLSocketFactory() throws Exception{
		String cerpath = mqttProp.getProperty("cacert");
		if(StringUtility.isNullOrEmpty(cerpath)){
			String castr = mqttProp.getProperty("cacertstr");
			String certstr = mqttProp.getProperty("certstr");
			if(StringUtility.isNullOrEmpty(castr) || StringUtility.isNullOrEmpty(certstr)){
				return null;
			}else{
				return getSSLSocketFactoryFromCertStr(castr, certstr);
			}
		}
		String clientcerpath = mqttProp.getProperty("clientcert");
		String clientkeypath = mqttProp.getProperty("clientkey");
		String certkeypwd = ConvertUtility.getValueAsString(mqttProp.getProperty("certkeypwd"));
		
		byte[] caraw = FileUtility.getBytesFromClassPath(cerpath);
		
		byte[] clientcertraw;
		if(StringUtility.isNullOrEmpty(clientcerpath)) {
			clientcertraw = new byte[0];
		}else {
			clientcertraw = FileUtility.getBytesFromClassPath(clientcerpath);
		}
		
		byte[] clientkeyraw;
		if(StringUtility.isNullOrEmpty(clientkeypath)){
			clientkeyraw = new byte[0];
		}else{
			clientkeyraw = FileUtility.getBytesFromClassPath(clientkeypath);
		}
		
		String sslver = mqttProp.getProperty("sslver");
		SSLSocketFactory fac = SSLUtility.getSocketFactory(caraw, clientcertraw, clientkeyraw, certkeypwd, sslver);
		return fac;
	}

	@Override
	public MsgQueue getMsgQueue(String queuename) {
		try{
			if(client == null){
				client = new MqttClient(broker, clientId, persistence);
				client.connect(connOpts);
			}
			if(!client.isConnected()){
				client.reconnect();
			}
			int qos = ConvertUtility.getValueAsInt(mqttProp.get("qos"), 0);
			MqttQueue queue = new MqttQueue(client, queuename, qos); 
			return queue;
		}catch(Exception e){
			throw new AppException(e);
		}
	}

	@Override
	public void shutdown() {
		close();
	}

	@Override
	public void setPropertiesPath(String proppath) {
		build(proppath);
	}

}
