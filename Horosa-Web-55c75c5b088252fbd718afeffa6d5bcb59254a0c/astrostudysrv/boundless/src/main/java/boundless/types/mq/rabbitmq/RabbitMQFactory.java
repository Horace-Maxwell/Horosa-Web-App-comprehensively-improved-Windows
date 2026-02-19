package boundless.types.mq.rabbitmq;

import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.types.mq.IMsgQueueFactory;
import boundless.types.mq.MsgQueue;
import boundless.utility.ConvertUtility;
import boundless.utility.ProgArgsHelper;
import boundless.utility.StringUtility;

public class RabbitMQFactory implements IMsgQueueFactory {
	private static Logger log = LoggerFactory.getLogger(MsgQueue.class);
	private static Properties rabbitmqProp;
	private static Connection connection;
	
	private static void getConnection(){
		String host = ConvertUtility.getValueAsString(rabbitmqProp.get("rabbitmq.ip"));
		int port = ConvertUtility.getValueAsInt(rabbitmqProp.get("rabbitmq.port"));		
		
		String user = ConvertUtility.getValueAsString(rabbitmqProp.get("rabbitmq.user"));
		String password = ConvertUtility.getValueAsString(rabbitmqProp.get("rabbitmq.password"));
		
		
		ConnectionFactory factory = new ConnectionFactory();
		factory.setHost(host);
		if(port > 0){
			factory.setPort(port);
		}
		if(!StringUtility.isNullOrEmpty(user)){
			factory.setUsername(user);
		}
		if(!StringUtility.isNullOrEmpty(password)){
			factory.setPassword(password);
		}
		
		try {
			connection = factory.newConnection();
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public synchronized void build(String proppath){
		close();
		
		rabbitmqProp = FileUtility.getProperties(proppath);
		ProgArgsHelper.convertProperties(rabbitmqProp);

		getConnection();
	}
	
	public static void close(){
		try{
			if(connection != null){
				connection.close(1000);
			}
		}catch(Exception e){
			QueueLog.error(log, e);
		}
	}

	@Override
	public MsgQueue getMsgQueue(String queuename) {
		if(connection == null){
			throw new RuntimeException("rabbit.connection.is.null");
		}
		boolean durable = ConvertUtility.getValueAsBool(rabbitmqProp.get("rabbitmq.durable"), false);
		int msgexpires = ConvertUtility.getValueAsInt(rabbitmqProp.get("rabbitmq.msg.expires"));
		int queueexpires = ConvertUtility.getValueAsInt(rabbitmqProp.get("rabbitmq.queue.expires"));
		long maxlength = ConvertUtility.getValueAsLong(rabbitmqProp.get("rabbitmq.queue.maxlength"));
		try {
			Channel channel = connection.createChannel();
			return new RabbitMQ(channel, queuename, durable, msgexpires, queueexpires, maxlength);
		} catch (Exception e) {
			try{
				QueueLog.error(log, e);
				getConnection();
				Channel channel = connection.createChannel();
				return new RabbitMQ(channel, queuename, durable, msgexpires, queueexpires, maxlength);
			}catch(Exception err){
				throw new RuntimeException(err);
			}
		}
	}
	
	public void shutdown(){
		close();
	}

	public void setPropertiesPath(String proppath){
		build(proppath);
	}
	
}
