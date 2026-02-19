package boundless.types.mq.kafka;

import java.util.Properties;
import java.util.concurrent.TimeUnit;

import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.types.mq.IMsgQueueFactory;
import boundless.types.mq.MsgQueue;
import boundless.utility.ConvertUtility;
import boundless.utility.ProgArgsHelper;

public class KafkaMQFactory implements IMsgQueueFactory {
	private static Logger log = LoggerFactory.getLogger(MsgQueue.class);
	private static Properties kafkaProp;
	
	private static Producer<String, String> producer;

	private static void getConnection(){
		Properties props = new Properties();
		
		String ips = ConvertUtility.getValueAsString(kafkaProp.get("kafka.ips"));
		long batchsize = ConvertUtility.getValueAsLong(kafkaProp.get("kafka.batch.size"));
		long buffermem = ConvertUtility.getValueAsLong(kafkaProp.get("kafka.buffer.memory"));
		int retries = ConvertUtility.getValueAsInt(kafkaProp.get("kafka.retries"));

		props.put("bootstrap.servers", ips);
		props.put("acks", "all");
		props.put("retries", retries);
		props.put("batch.size", batchsize);
		props.put("linger.ms", 1);
		props.put("buffer.memory", buffermem);
		props.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
		props.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");
		
		producer = new KafkaProducer<>(props);
	}

	public synchronized void build(String proppath){
		close();
		
		kafkaProp = FileUtility.getProperties(proppath);
		ProgArgsHelper.convertProperties(kafkaProp);

		getConnection();
	}
	
	public static void close(){
		try{
			if(producer != null){
				producer.close();
			}
		}catch(Exception e){
			QueueLog.error(log, e);
		}
	}

	
	@Override
	public MsgQueue getMsgQueue(String queuename) {
		Properties props = new Properties();
		String ips = ConvertUtility.getValueAsString(kafkaProp.get("kafka.ips"));
		String autocommit = ConvertUtility.getValueAsString(kafkaProp.get("kafka.consumer.enable.auto.commit"));
		String commitinterval = ConvertUtility.getValueAsString(kafkaProp.get("kafka.consumer.auto.commit.interval.ms"));
		String timeout = ConvertUtility.getValueAsString(kafkaProp.get("kafka.consumer.session.timeout.ms"));

		props.put("bootstrap.servers", ips);
		props.put("enable.auto.commit", autocommit);
		props.put("auto.commit.interval.ms", commitinterval);
		props.put("session.timeout.ms", timeout);
		props.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
		props.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");

		props.put("group.id", queuename);
		
		KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
		KafkaMQ kafka = new KafkaMQ(producer, consumer, queuename);
		return kafka;
	}

	@Override
	public void shutdown() {
		close();
	}

	public void setPropertiesPath(String proppath){
		build(proppath);
	}

}
