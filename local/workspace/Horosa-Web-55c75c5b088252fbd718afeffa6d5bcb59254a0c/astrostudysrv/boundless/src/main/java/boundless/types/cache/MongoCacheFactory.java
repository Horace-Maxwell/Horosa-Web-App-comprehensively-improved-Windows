package boundless.types.cache;

import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.TimeUnit;

import org.bson.Document;
import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.MongoCredential;
import com.mongodb.ServerAddress;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.mongodb.connection.ClusterSettings;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.utility.ConvertUtility;
import boundless.utility.ProgArgsHelper;
import boundless.utility.StringUtility;
import java.nio.file.Path;
import java.nio.file.Paths;

public class MongoCacheFactory implements ICacheFactory {
	private static final String OptionalEnvKey = "HOROSA_DESKTOP_MONGO_OPTIONAL";
	private static final String SkipPingEnvKey = "HOROSA_DESKTOP_MONGO_SKIP_PING";
	private static final String FallbackDirEnvKey = "HOROSA_MONGO_FALLBACK_DIR";
	static final String RedactOnPersistKey = "fallback.redactonpersist";

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
	private LocalDocumentCache fallbackCache = null;
	private boolean optionalMode = false;
	private boolean skipPingOnBuild = false;
	
	private Boolean needMemCache = null;
	private Boolean needCompress = null;
	/** Mongo 缺席走本地回落缓存时,写盘前是否脱敏(配置项 fallback.redactonpersist;装请求记录的缓存必须开,见 mongotranslog.properties)。 */
	private boolean redactOnPersist = false;
	
	public void build(){
		String path = "classpath:/conf/properties/mongodb.properties";
		build(path);
	}
	
	@Override
	public void build(String proppath){
		close();
		this.fallbackCache = null;
		
		Properties p = FileUtility.getProperties(proppath);
		ProgArgsHelper.convertProperties(p);
		this.optionalMode = isOptionalModeEnabled();
		this.skipPingOnBuild = isSkipPingEnabled();

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
		this.redactOnPersist = ConvertUtility.getValueAsBool(p.get(RedactOnPersistKey), false);
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
		if(this.optionalMode && this.skipPingOnBuild) {
			this.fallbackCache = new LocalDocumentCache(resolveFallbackCacheName(), keyField, valueField, resolveFallbackPath(), this.redactOnPersist);
			return;
		}
		
		ClusterSettings clusterSettings = ClusterSettings.builder().hosts(servers).build();
		
		MongoClientSettings.Builder builder = MongoClientSettings.builder();
		builder.applyToClusterSettings((clusterBuilder)->{
			clusterBuilder.applySettings(clusterSettings);
			if(this.optionalMode) {
				clusterBuilder.serverSelectionTimeout(1000, TimeUnit.MILLISECONDS);
			}
		});
		if(this.optionalMode) {
			builder.applyToSocketSettings((socketBuilder)->{
				socketBuilder.connectTimeout(1000, TimeUnit.MILLISECONDS);
				socketBuilder.readTimeout(2000, TimeUnit.MILLISECONDS);
			});
			builder.applyToServerSettings((serverBuilder)->{
				serverBuilder.heartbeatFrequency(1000, TimeUnit.MILLISECONDS);
			});
		}

		List<MongoCredential> credentials = new ArrayList<MongoCredential>();
		if(!StringUtility.isNullOrEmpty(username)){
			MongoCredential credential = MongoCredential.createCredential(username, dbName, password.toCharArray());
			credentials.add(credential);
			builder.credential(credential);
		}
		
		settings = builder.build();
		mongoClient = MongoClients.create(settings);
		if(this.optionalMode && !canConnect()) {
			QueueLog.info(AppLoggers.InfoLogger,
					"mongo optional mode enabled for cache factory {}, collection {}, switching to local fallback cache.",
					this.name, this.collectionName);
			close();
			this.fallbackCache = new LocalDocumentCache(resolveFallbackCacheName(), keyField, valueField, resolveFallbackPath(), this.redactOnPersist);
		}
	}

	@Override
	public void reconnect(){
		if(this.fallbackCache != null) {
			return;
		}
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
		this.hasCreatedIndex = false;
		if(mongoClient != null){
			mongoClient.close();
			mongoClient = null;
		}
	}


	@Override
	public ICache getCache() {
		if(this.fallbackCache != null) {
			return this.fallbackCache;
		}
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
		factory.redactOnPersist = this.redactOnPersist;
		factory.hasCreatedIndex = false;
		factory.optionalMode = this.optionalMode;
		factory.skipPingOnBuild = this.skipPingOnBuild;
		if(this.fallbackCache != null) {
			factory.fallbackCache = new LocalDocumentCache(factory.resolveFallbackCacheName(), factory.keyField, factory.valueField, factory.resolveFallbackPath(), factory.redactOnPersist);
		}
		
		return factory;
	}

	private boolean isOptionalModeEnabled() {
		String env = System.getenv(OptionalEnvKey);
		if(StringUtility.isNullOrEmpty(env)) {
			return false;
		}
		return ConvertUtility.getValueAsBool(env, false);
	}

	private boolean isSkipPingEnabled() {
		String env = System.getenv(SkipPingEnvKey);
		if(StringUtility.isNullOrEmpty(env)) {
			return false;
		}
		return ConvertUtility.getValueAsBool(env, false);
	}

	private boolean canConnect() {
		if(this.mongoClient == null) {
			return false;
		}
		try {
			MongoDatabase db = this.mongoClient.getDatabase(dbName);
			db.runCommand(new Document("ping", 1));
			return true;
		}catch(Exception e) {
			QueueLog.info(AppLoggers.InfoLogger, "mongo ping failed for cache factory {}: {}", this.name, e.getMessage());
			return false;
		}
	}

	private String resolveFallbackCacheName() {
		if(!StringUtility.isNullOrEmpty(this.name)) {
			return this.name;
		}
		if(!StringUtility.isNullOrEmpty(this.collectionName)) {
			return this.collectionName;
		}
		return "mongo-fallback";
	}

	private Path resolveFallbackPath() {
		String root = System.getenv(FallbackDirEnvKey);
		if(StringUtility.isNullOrEmpty(root)) {
			root = Paths.get(System.getProperty("user.dir", "."), ".horosa-cache", "mongo-fallback").toString();
		}
		String cacheName = resolveFallbackCacheName().replaceAll("[^A-Za-z0-9._-]", "_");
		return Paths.get(root, cacheName + ".json");
	}
	
}
