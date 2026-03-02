package boundless.types.mq.mqtt;

import java.util.HashMap;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

import org.eclipse.paho.client.mqttv3.IMqttMessageListener;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttMessage;

import boundless.function.Consumer3;
import boundless.types.mq.MsgQueue;
import boundless.utility.JsonUtility;

public class MqttQueue implements MsgQueue {
	
	private MqttClient client;
	private String queueName;
	private int qos = 0;
	
	private Map<String, Object> topicAttach = new HashMap<String, Object>();
	
	MqttQueue(MqttClient client, String queueName, int qos){
		this.client = client;
		this.queueName = queueName;
		this.qos = qos;
	}

	@Override
	public void close() {
		topicAttach.clear();
	}
	
	public void publish(String msg){
		publish(this.queueName, msg);
	}

	public void publish(String topickey, String msg){
		try{
			byte[] raw = msg.getBytes("UTF-8");
			MqttMessage message = new MqttMessage(raw);
			message.setQos(this.qos);
			client.publish(topickey, message);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
		
	}

	public void publish(byte[] msg){
		publish(this.queueName, msg);
	}

	public void publish(String topickey, byte[] msg){
		try{
			MqttMessage message = new MqttMessage(msg);
			message.setQos(this.qos);
			client.publish(topickey, message);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
		
	}

	@Override
	public void subscribe(Consumer<String> handler, Consumer<Exception> exhandler) {
		subscribe(this.queueName, (topic, raw)->{
			if(handler != null){
				try{
					String msg = new String(raw, "UTF-8");
					Map<String, String> map = new HashMap<String, String>();
					map.put("topic", topic);
					map.put("msg", msg);
					handler.accept(JsonUtility.encode(map));
				}catch(Exception e){
					throw new RuntimeException(e);
				}
			}
		}, exhandler);
	}

	@Override
	public void subscribe(String topickey, Consumer<String> handler, Consumer<Exception> exhandler) {
		subscribe(topickey, (topic, raw)->{
			if(handler != null){
				try{
					String msg = new String(raw, "UTF-8");
					Map<String, String> map = new HashMap<String, String>();
					map.put("topic", topic);
					map.put("msg", msg);
					handler.accept(JsonUtility.encode(map));
				}catch(Exception e){
					throw new RuntimeException(e);
				}
			}
		}, exhandler);
	}

	public void subscribe(String topickey, BiConsumer<String, byte[]> handler, Consumer<Exception> exhandler){
		IMqttMessageListener msglis = new IMqttMessageListener(){
			@Override
			public void messageArrived(String topic, MqttMessage message) throws Exception {
				byte[] raw = message.getPayload();
				if(handler != null){
					handler.accept(topic, raw);
				}
			}
		};
		
		try{
			client.subscribe(topickey, msglis);
		}catch(Exception e){
			if(exhandler != null){
				exhandler.accept(e);
			}
		}
	}

	public void subscribe(String topickey, Object payload, Consumer3<String, byte[], Object> handler, Consumer<Exception> exhandler){
		IMqttMessageListener msglis = new IMqttMessageListener(){
			@Override
			public void messageArrived(String topic, MqttMessage message) throws Exception {
				byte[] raw = message.getPayload();
				Object attach = topicAttach.get(topic);
				if(handler != null){
					handler.accept(topic, raw, attach);
				}
			}
		};
		
		try{
			topicAttach.put(topickey, payload);
			client.subscribe(topickey, msglis);
		}catch(Exception e){
			if(exhandler != null){
				exhandler.accept(e);
			}
		}
	}

}
