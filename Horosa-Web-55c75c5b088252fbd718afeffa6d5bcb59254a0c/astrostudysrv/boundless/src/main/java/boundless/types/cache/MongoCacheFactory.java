package boundless.types.cache;

import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.MongoCredential;
import com.mongodb.ServerAddress;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.mongodb.connection.ClusterSettings;

import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.ProgArgsHelper;
import boundless.utility.StringUtility;

public class MongoCacheFactory implements ICacheFactory {

	private MongoClient mongoClient;
	private String dbName;
	private String collectionName;
	private String username;
	private String password;
	private String keyField = "_id";
	private String valueField = "v";
	private String name;
	
	MongoClientSettings settings;
	private List<ServerAddress> servers = new ArrayList<ServerAddress>();
	
	private boolean hasCreatedIndex = false;
	
	private Boolean needMemCache = null;
	private Boolean needCompress = null;
	
	public void build(){
		String path = "classpath:/conf/properties/mongodb.properties";
		build(path);
	}
	
	@Override
	public void build(String proppath){
		close();
		
		Properties p = FileUtility.getProperties(proppath);
		ProgArgsHelper.convertProperties(p);

		servers.clear();
		
		String ips = ConvertUtility.getValueAsString(p.get("mongodb.ips"));
		if(StringUtility.isNullOrEmpty(ips)){
			String ip = ConvertUtility.getValueAsString(p.get("mongodb.ip"));
			int port = ConvertUtility.getValueAsInt(p.get("mongodb.port"));
			if(port <= 0){
				port = 27017;
			}
			servers.add(new ServerAddress(ip, port));
		}else{
			String[] hosts = ips.split(",");
			for(String host : hosts){
				String[] parts = host.split("\\:");
				ServerAddress serv = new ServerAddress(parts[0], ConvertUtility.getValueAsInt(parts[1]));
				servers.add(serv);
			}
		}
		
		dbName = ConvertUtility.getValueAsString(p.get("mongodb.db"));
		collectionName = ConvertUtility.getValueAsString(p.get("mongodb.db.collection"));
		keyField = ConvertUtility.getValueAsString(p.get("mongodb.db.collection.keyfield"));
		valueField = ConvertUtility.getValueAsString(p.get("mongodb.db.collection.valuefield"));
		username = ConvertUtility.getValueAsString(p.get("mongodb.db.username"));
		password = ConvertUtility.getValueAsString(p.get("mongodb.db.password"));
		Object nmcobj = p.get("needlocalmemcache");
		if(nmcobj != null){
			this.needMemCache = ConvertUtility.getValueAsBool(nmcobj, false);
		}
		Object ncompress = p.get("needcompress");
		if(ncompress != null){
			needCompress = ConvertUtility.getValueAsBool(ncompress, false);
		}

		if(StringUtility.isNullOrEmpty(keyField)){
			keyField = "_id";
		}
		if(StringUtility.isNullOrEmpty(valueField)){
			valueField = "v";
		}
		
		ClusterSettings clusterSettings = ClusterSettings.builder().hosts(servers).build();
		
		MongoClientSettings.Builder builder = MongoClientSettings.builder();
		builder.applyToClusterSettings((clusterBuilder)->{
			clusterBuilder.applySettings(clusterSettings);
		});

		List<MongoCredential> credentials = new ArrayList<MongoCredential>();
		if(!StringUtility.isNullOrEmpty(username)){
			MongoCredential credential = MongoCredential.createCredential(username, dbName, password.toCharArray());
			credentials.add(credential);
			builder.credential(credential);
		}
		
		settings = builder.build();
		mongoClient = MongoClients.create(settings);
	}

	@Override
	public void reconnect(){
		long st = System.currentTimeMillis();
		try{
			close();
			System.gc();
			
	        List<MongoCredential> credentials = new ArrayList<MongoCredential>();
			if(!StringUtility.isNullOrEmpty(username)){
				MongoCredential credential = MongoCredential.createCredential(username, dbName, password.toCharArray());
				credentials.add(credential);
			}
			
			mongoClient = MongoClients.create(settings);
		}catch(Exception e){
			QueueLog.error(ICache.log, e);
			QueueLog.debug(ICache.log, "recnnect error in {} ms, for MongoCacheFactory, errmsg:{}", System.currentTimeMillis() - st, e.getMessage());
		}finally{
			QueueLog.debug(ICache.log, "finish recnnect in {} ms, for MongoCacheFactory", System.currentTimeMillis() - st);
		}
	}
	
	@Override
	public void close(){
		if(mongoClient != null){
			mongoClient.close();
			mongoClient = null;
		}
	}


	@Override
	public ICache getCache() {
		if(mongoClient != null){
			MongoDatabase db = mongoClient.getDatabase(dbName);
			MongoCache cache = new MongoCache(db, collectionName, keyField, valueField);
			if(!this.hasCreatedIndex){
				cache.createIndex();
				this.hasCreatedIndex = true;
			}
			return cache;
		}
		return null;
	}


	public void setPropertiesPath(String proppath){
		build(proppath);
	}

	@Override
	public Boolean needMemCache(){
		return this.needMemCache;
	}
	
	@Override
	public Boolean needCompress(){
		return this.needCompress;
	}

	@Override
	public String factoryName() {
		return this.name;
	}

	@Override
	public void factoryName(String name) {
		this.name = name;
	}
	
	@Override
	public ICacheFactory spawnFactory(String dataSetName){
		MongoCacheFactory factory = new MongoCacheFactory();
		factory.collectionName = dataSetName;
		factory.dbName = this.dbName;
		factory.mongoClient = this.mongoClient;
		factory.settings = this.settings;
		factory.username = this.username;
		factory.password = this.password;
		factory.keyField = this.keyField;
		factory.valueField = this.valueField;
		factory.name = String.format("%s_%s", this.name, dataSetName);
		factory.servers = this.servers;
		factory.needMemCache = this.needMemCache;
		factory.needCompress = this.needCompress;
		factory.hasCreatedIndex = false;
		
		return factory;
	}
	
}
