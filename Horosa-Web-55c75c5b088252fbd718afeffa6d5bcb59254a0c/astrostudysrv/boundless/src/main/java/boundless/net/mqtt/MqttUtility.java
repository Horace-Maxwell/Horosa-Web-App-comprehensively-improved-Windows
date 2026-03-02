package boundless.net.mqtt;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocketFactory;

import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttClientPersistence;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

import boundless.io.FileUtility;
import boundless.net.ssl.SSLUtility;
import boundless.types.OutParameter;
import boundless.utility.StringUtility;

public class MqttUtility {
	
	public static MqttClient createClient(String broker, String clientId, String username, String password, int qos) {
		return createClient(broker, clientId, username, password, qos, null);
	}
	
	public static MqttClient createClient(String broker, String clientId, String username, String password, int qos, String certclspath){
		MqttConnectOptions connOpts = new MqttConnectOptions();
		connOpts.setCleanSession(true);
		connOpts.setUserName(username);
		connOpts.setPassword(password.toCharArray());
		connOpts.setConnectionTimeout(5);
		HostnameVerifier hostnameVerifier = new HostnameVerifier(){
			@Override
			public boolean verify(String hostname, SSLSession session) {
				return true;
			}
		};
		connOpts.setSSLHostnameVerifier(hostnameVerifier);
		if(!StringUtility.isNullOrEmpty(certclspath) && broker.toLowerCase().startsWith("ssl://")) {
			try {
				byte[] caraw = FileUtility.getBytesFromClassPath(certclspath);
				SSLSocketFactory fac = SSLUtility.getSocketFactory(caraw);
				connOpts.setSocketFactory(fac);
			}catch(Exception e) {
				throw new RuntimeException(e);
			}

		}
		MqttClient client = null;
		try{
			MqttClientPersistence persistence = new MemoryPersistence();			
			client = new MqttClient(broker, clientId, persistence);
			client.connect(connOpts);
			return client;
		}catch(Exception e){
			if(client != null){
				try{
					client.disconnect(0);
				}catch(Exception err){
				}
				try{
					client.close(true);
				}catch(Exception err){
				}
			}
			throw new RuntimeException(e);
		}
	}
	
	public static boolean checkConfigOk(String broker, String clientId, String username, String password, int qos, String certpath, OutParameter<String> errmsg){
		MqttClient client = null;
		try{
			client = createClient(broker, clientId, username, password, qos, certpath);
			return true;
		}catch(Exception e){
			if(errmsg != null){
				errmsg.value = e.getMessage();
			}
			return false;
		}finally{
			if(client != null){
				try{
					client.disconnect(0);
				}catch(Exception err){
				}
				try{
					client.close(true);
				}catch(Exception err){
				}
			}
		}
	}
	
	public static boolean checkConfigOk(String broker, String clientId, String username, String password, int qos, String certpath){
		return checkConfigOk(broker, clientId, username, password, qos, certpath, null);
	}
	
	public static void publish(MqttClient client, String topic, String msg, int qos){
		try{
			byte[] raw = msg.getBytes("UTF-8");
			MqttMessage message = new MqttMessage(raw);
			message.setQos(qos);
			client.publish(topic, message);
		}catch(Exception e){
			throw new RuntimeException(e);
		}

	}
}
