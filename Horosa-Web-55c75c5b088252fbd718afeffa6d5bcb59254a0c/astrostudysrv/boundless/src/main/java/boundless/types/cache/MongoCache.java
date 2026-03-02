package boundless.types.cache;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import org.bson.BsonArray;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.slf4j.Logger;

import com.mongodb.client.AggregateIterable;
import com.mongodb.client.FindIterable;
import com.mongodb.client.ListIndexesIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.types.ICache;
import boundless.types.cache.FilterCond.CondOperator;
import boundless.utility.ConvertUtility;
import boundless.utility.FormatUtility;
import boundless.utility.JsonUtility;
import boundless.utility.SerialCalculatePool;
import boundless.utility.StringUtility;

public class MongoCache implements ICache {
	public static final String ExpiresField = "_expires_";
	public static final String TimeField = "_time_";

	private static Logger log = AppLoggers.getLog("cache", "mongo");
	private static boolean statementLog  = PropertyPlaceholder.getPropertyAsBool("mongo.statement.log", false);

	private final String DefaultCollectionName = "mongoascache";
	
	
	private String collectionName;
	private MongoDatabase db;
	private MongoCollection<Document> collection;
	
	private String keyField = "_id";
	private String valueField = "v";

	public MongoCache(MongoDatabase db, String collName, String keyfld, String valuefld) {
		this.db = db;
		
		this.collectionName = DefaultCollectionName;
		if(!StringUtility.isNullOrEmpty(collName)){
			this.collectionName = collName;
		}

		this.keyField = keyfld;
		this.valueField = valuefld;
		if(StringUtility.isNullOrEmpty(keyField)){
			keyField = "_id";
		}
		if(StringUtility.isNullOrEmpty(valueField)){
			valueField = "v";
		}

		this.collection = this.db.getCollection(this.collectionName);
		
	}
	
	void createIndex(){
		if(keyField.equals("_id")){
			return;
		}
		
		IndexOptions keyopt = new IndexOptions();
		keyopt.unique(true);
		keyopt.name(keyField);
				
		boolean haskeyidx = false;
		
		MongoCursor<Document> iter = this.collection.listIndexes().iterator();
		while(iter.hasNext()){
			Document doc = iter.next();
			String idxname = doc.getString("name");
			if(idxname.equals(keyField)){
				haskeyidx = true;
				break;
			}
		}
		
		try{
			if(iter != null){
				iter.close();
			}
			if(!haskeyidx){
				this.collection.createIndex(new Document(keyField, 1), keyopt);
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
		}

	}

	@Override
	public void put(String key, Object value) {
		Document doc = new Document(keyField, key);
		doc.append(valueField, value);
		doc.append(ExpiresField, 0);
		Document setbson = new Document("$set", doc);
		
		UpdateResult res = this.collection.updateOne(Filters.eq(keyField, key), setbson);
		if(res.getModifiedCount() == 0 && !containsKey(key)){
			try{
				this.collection.insertOne(doc);
			}catch(Exception e){
				this.collection.updateOne(Filters.eq(keyField, key), setbson);
			}
		}
	}
	
	@Override
	public void put(String key, Object value, int timeToIdleSeconds, int timeToLiveSeconds){
		Document doc = new Document(keyField, key);
		doc.append(valueField, value);
		doc.append(ExpiresField, timeToLiveSeconds);
		doc.append(TimeField, System.currentTimeMillis());
		Document setbson = new Document("$set", doc);
		
		UpdateResult res = this.collection.updateOne(Filters.eq(keyField, key), setbson);
		if(res.getModifiedCount() == 0 && !containsKey(key)){
			try{
				this.collection.insertOne(doc);
			}catch(Exception e){
				this.collection.updateOne(Filters.eq(keyField, key), setbson);
			}
		}
	}
	
	@Override
	public String getRemoteCacheName(){ 
		return this.collectionName; 
	}
	
	@Override
	public Long expire(final String key, final int seconds){ 
		Object value = get(key);
		if(value == null){
			return 0L; 
		}
		
		Document doc = new Document(keyField, key);
		doc.append(valueField, value);
		doc.append(ExpiresField, seconds);
		doc.append(TimeField, System.currentTimeMillis());
		
		UpdateResult res = this.collection.updateOne(Filters.eq(keyField, key), new Document("$set", doc));
		if(res.getModifiedCount() == 0){
			return 0L; 
		}
		return 1L; 
	}
	
	@Override
	public Long expireAt(final String key, final long unixTime){ 
		Object value = get(key);
		if(value == null){
			return 0L; 
		}
		
		long tm = System.currentTimeMillis();
		long seconds = (unixTime - tm) / 1000;
		if(seconds <= 0){
			remove(key);
			return 1L;
		}
		
		Document doc = new Document(keyField, key);
		doc.append(valueField, value);
		doc.append(ExpiresField, seconds);
		doc.append(TimeField, tm);
		
		UpdateResult res = this.collection.updateOne(Filters.eq(keyField, key), new Document("$set", doc));
		if(res.getModifiedCount() == 0){
			return 0L; 
		}
		return 1L; 
	}

	@Override
	public Object get(String key) {
		FindIterable<Document> findIterable = this.collection.find(Filters.eq(keyField, key));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remove(key);
            		mongoCursor.close();
            		return null;
            	}
            }
            Object obj = doc.get(valueField);
            if(obj instanceof Document){
            	obj = documentToMap((Document)obj);
            }else if(obj instanceof List){
            	List list = (List)obj;
            	if(!list.isEmpty() && list.get(0) instanceof Document){
            		obj = docListToMapList((List<Document>) obj);
            	}
            }
            mongoCursor.close();
            return obj;
        }
		if(mongoCursor != null){
			mongoCursor.close();
		}
		return null;
	}

	@Override
	public boolean containsKey(String key) {
		FindIterable<Document> findIterable = this.collection.find(Filters.eq(keyField, key));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		if(mongoCursor == null){
			return false;
		}
		boolean res = mongoCursor.hasNext();
		mongoCursor.close();
		return res;
	}

	@Override
	public long remove(String key) {
		DeleteResult res = this.collection.deleteMany(Filters.eq(keyField, key));
		return res.getDeletedCount();
	}
	
	public long remove(String fld, String value) {
		DeleteResult res = this.collection.deleteMany(Filters.eq(fld, value));
		return res.getDeletedCount();		
	}

	public long remove(String fld, long value) {
		DeleteResult res = this.collection.deleteMany(Filters.eq(fld, value));
		return res.getDeletedCount();		
	}

	public long remove(String fld, int value) {
		DeleteResult res = this.collection.deleteMany(Filters.eq(fld, value));
		return res.getDeletedCount();		
	}
	
	private Bson getBson(FilterCond... conds) {
		if(conds == null || conds.length == 0) {
			return null;
		}
		List<Bson> filist = new ArrayList<Bson>();
		FilterCond[] condsary = new FilterCond[0];
		if(conds != null && conds.length > 0){
			condsary = conds;
		}
		
		for(FilterCond cond : condsary){
			if(cond != null) {
				filist.add(cond.toBson());				
			}
		}
		Bson[] filters = new Bson[filist.size()];
		filist.toArray(filters);
		
		Bson filter = null;
		if(filters.length == 1){
			filter = filters[0];
		}else if(filters.length > 0){
			filter = Filters.and(filters);
		}
		
		return filter;
	}
	
	public long remove(FilterCond... conds) {
		Bson filter = getBson(conds);
		if(filter == null) {
			return 0;
		}
		DeleteResult res = this.collection.deleteMany(filter);
		return res.getDeletedCount();
	}

	@Override
	public void clear() {
		this.collection.drop();
	}
	
	@Override
	public long removeMany(String partKey){
		String pattern = partKey;
		DeleteResult res = this.collection.deleteMany(Filters.regex(keyField, pattern));
		return res.getDeletedCount();
	}
	
	public long removeAllByExpired(int n){
		DeleteResult res = this.collection.deleteMany(Filters.gt("_expires_", n));
		return res.getDeletedCount();
	}
	
	public long remove(String field, Object value) {
		DeleteResult res = this.collection.deleteMany(Filters.eq(field, value));
		return res.getDeletedCount();		
	}
	
	public long remove(FilterCond cond) {
		Bson filter = cond.toBson();
		DeleteResult res = this.collection.deleteMany(filter);
		return res.getDeletedCount();
	}
	
	@Override
	public long countKey(String partKey){
		String pattern = partKey;
		return this.collection.countDocuments(Filters.regex(keyField, pattern));
	}
	
	@Override
	public Map<String, Object> getMany(String partKey){
		Map<String, Object> map = new HashMap<String, Object>();
		String pattern = partKey;
		
		FindIterable<Document> findIterable = this.collection.find(Filters.regex(keyField, pattern));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
        	String key = doc.getString(keyField);
        	Object value = doc.get(valueField);
        	boolean removed = false;
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remove(key);
            		removed = true;
            	}
            }
            if(!removed){
            	map.put(key, value);
            }
        }
		if(mongoCursor != null){
			mongoCursor.close();
		}
		return map;
	}

	@Override
	public Object get(String key, String field){ 
		FindIterable<Document> findIterable = this.collection.find(Filters.eq(keyField, key));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remove(key);
            		mongoCursor.close();
            		return null;
            	}
            }
            Object obj = doc.get(field);
            if(obj instanceof Document){
            	obj = documentToMap((Document)obj);
            }else if(obj instanceof List){
            	List list = (List)obj;
            	if(!list.isEmpty() && list.get(0) instanceof Document){
            		obj = docListToMapList((List<Document>) obj);
            	}
            }
    		mongoCursor.close();
    		return obj;
        }
		if(mongoCursor != null){
			mongoCursor.close();
		}
		return null;
	}
	
	@Override
	public Map<String, Object> getFieldsValue(String key, String... fields){ 
		if(fields == null || fields.length == 0){
			return null;
		}
		
		Map<String, Object> map = new HashMap<String, Object>();
		FindIterable<Document> findIterable = this.collection.find(Filters.eq(keyField, key));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remove(key);
            		mongoCursor.close();
            		return map;
            	}
            }
            for(int i=0; i<fields.length; i++){
            	String field = fields[i];
                Object obj = doc.get(field);
                if(obj instanceof Document){
                	Document resdoc = (Document) obj;
                	Map<String, Object> resmap = documentToMap(resdoc);
                	map.put(field, resmap);
                }else if(obj instanceof List){
                	List list = (List)obj;
                	if(!list.isEmpty() && list.get(0) instanceof Document){
                		map.put(field, docListToMapList((List<Document>) obj));
                	}else{
                		map.put(field, obj);
                	}
                }else{
                    map.put(field, obj);
                }
            }
    		mongoCursor.close();
    		return map;
        }
		if(mongoCursor != null){
			mongoCursor.close();
		}
		return map;
	}
	
	private Map<String, Object> documentToMap(Document doc){
		Map<String, Object> map = new HashMap<String, Object>();
		for(Map.Entry<String, Object> entry : doc.entrySet()){
			String key = entry.getKey();
			Object obj = entry.getValue();
			if(obj instanceof Document){
				obj = documentToMap((Document)obj);
			}else if(obj instanceof List){
				List list = (List)obj;
				if(list != null && !list.isEmpty() && list.get(0) instanceof Document){
					obj = docListToMapList((List<Document>) list);					
				}
			}
			map.put(key, obj);
		}
    	return map;
	}
	
	private List<Map<String, Object>> docListToMapList(List<Document> list){
		List<Map<String, Object>> reslist = new ArrayList<Map<String, Object>>(list.size());
		for(Object itm : list){
			Document d = (Document) itm;
			reslist.add(documentToMap(d));
		}
		return reslist;
	}
	
	public Map<String, Object> getFieldsValue(Object key, String... fields){ 
		if(fields == null || fields.length == 0){
			return null;
		}
		
		Map<String, Object> map = new HashMap<String, Object>();
		FindIterable<Document> findIterable = this.collection.find(Filters.eq(keyField, key));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remove(key);
            		mongoCursor.close();
            		return map;
            	}
            }
            for(int i=0; i<fields.length; i++){
            	String field = fields[i];
                Object obj = doc.get(field);
                if(obj instanceof Document){
                	Document resdoc = (Document) obj;
                	Map<String, Object> resmap = documentToMap(resdoc);
                	map.put(field, resmap);
                }else if(obj instanceof List){
                	List list = (List)obj;
                	if(!list.isEmpty() && list.get(0) instanceof Document){
                		map.put(field, docListToMapList((List<Document>) obj));
                	}else{
                		map.put(field, obj);
                	}
                }else{
                    map.put(field, obj);
                }
            }
    		mongoCursor.close();
    		return map;
        }
		if(mongoCursor != null){
			mongoCursor.close();
		}
		return map;
	}
	
	@Override
	public void putFieldValue(String key, String field, Object value){ 
		Document doc = new Document(keyField, key);
		doc.append(field, value);
		Document setbson = new Document("$set", doc);
		
		UpdateResult res = this.collection.updateOne(Filters.eq(keyField, key), setbson);
		if(res.getModifiedCount() == 0 && !containsKey(key)){
			try{
				this.collection.insertOne(doc);
			}catch(Exception e){
				this.collection.updateOne(Filters.eq(keyField, key), setbson);
			}
		}
	}
	
	@Override
	public long size(){
		return this.collection.countDocuments();
	}
	
	@Override
	public void forAll(Consumer<Map<String, Object>> consumer, String... fields){
		FindIterable<Document> findIterable = this.collection.find();
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
        	String key = doc.getString(keyField);
        	Map<String, Object> map = new HashMap<String, Object>();
        	map.put(keyField, key);
        	if(fields == null || fields.length == 0){
        		map.put(this.valueField, doc.get(valueField));
        	}else{
        		for(String field : fields){
        			map.put(field, doc.get(field));
        		}
        	}
        	consumer.accept(map);
        }
		mongoCursor.close();
	}
	
	@Override
	public long count(String key, String partValue){
		String pattern = partValue;
		return this.collection.countDocuments(Filters.regex(key, pattern));
	}
	
	@Override
	public long count(String key, long value){
		return this.collection.countDocuments(Filters.eq(key, value));
	}
	
	@Override
	public boolean containsKey(Object key){
		FindIterable<Document> findIterable = this.collection.find(Filters.eq(keyField, key));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		if(mongoCursor == null){
			return false;
		}
		boolean res = mongoCursor.hasNext();
		mongoCursor.close();
		return res;
	}
	
	@Override
	public long remove(Object key) {
		DeleteResult res = this.collection.deleteMany(Filters.eq(keyField, key));
		return res.getDeletedCount();
	}
	
	@Override
	public Object get(Object key){ 
		FindIterable<Document> findIterable = this.collection.find(Filters.eq(keyField, key));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remove(key);
            		mongoCursor.close();
            		return null;
            	}
            }
            Object obj = doc.get(valueField);
            mongoCursor.close();
            return obj;
        }
		if(mongoCursor != null){
			mongoCursor.close();
		}
		return null;
	}
	
	@Override
	public void put(Object key, Object value){ 
		Document doc = new Document(keyField, key);
		doc.append(valueField, value);
		doc.append(ExpiresField, 0);
		Document setbson = new Document("$set", doc);
		
		UpdateResult res = this.collection.updateOne(Filters.eq(keyField, key), setbson);
		if(res.getModifiedCount() == 0 && !containsKey(key)){
			try{
				this.collection.insertOne(doc);
			}catch(Exception e){
				this.collection.updateOne(Filters.eq(keyField, key), setbson);
			}
		}
	}
	
	@Override
	public void putFieldValue(Object key, String field, Object value){ 
		Document doc = new Document(keyField, key);
		doc.append(field, value);
		Document setbson = new Document("$set", doc);
		
		UpdateResult res = this.collection.updateOne(Filters.eq(keyField, key), setbson);
		if(res.getModifiedCount() == 0 && !containsKey(key)){
			try{
				this.collection.insertOne(doc);
			}catch(Exception e){
				this.collection.updateOne(Filters.eq(keyField, key), setbson);
			}
		}
	}
	
	@Override
	public void dropDataSet(){
		this.collection.drop();
	}
	
	public long countValues(FilterCond... conds){
		List<Bson> filist = new ArrayList<Bson>();
		FilterCond[] condsary = new FilterCond[0];
		if(conds != null && conds.length > 0){
			condsary = conds;
		}
		
		for(FilterCond cond : condsary){
			if(cond != null) {
				filist.add(cond.toBson());				
			}
		}
		Bson[] filters = new Bson[filist.size()];
		filist.toArray(filters);
		
		Bson filter = null;
		if(filters.length == 1){
			filter = filters[0];
		}else if(filters.length > 0){
			filter = Filters.and(filters);
		}

		if(filter == null) {
			return this.collection.countDocuments();
		}else {
			return this.collection.countDocuments(filter);			
		}
	}
	
	public List<Map<String, Object>> findValues(FilterCond... conds){
		List<Bson> filist = new ArrayList<Bson>();
		List<Map<String, Object>> list = new LinkedList<Map<String, Object>>();
		FilterCond[] condsary = new FilterCond[0];
		if(conds != null && conds.length > 0){
			condsary = conds;
		}
		
		for(FilterCond cond : condsary){
			if(cond != null) {
				filist.add(cond.toBson());				
			}
		}
		Bson[] filters = new Bson[filist.size()];
		filist.toArray(filters);
		
		Bson filter = null;
		if(filters.length == 1){
			filter = filters[0];
		}else if(filters.length > 0){
			filter = Filters.and(filters);
		}
		
		List<Object> remkeys = new LinkedList<Object>();
		
		FindIterable<Document> findIterable;
		if(filter != null) {
			findIterable = this.collection.find(filter);
		}else {
			findIterable = this.collection.find();
		}
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	Object keyvalue = doc.get(valueField);
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remkeys.add(keyvalue);
            		continue;
            	}
            }
        	Map<String, Object> resmap = documentToMap(doc);
        	list.add(resmap);
		}	
		
		for(Object kv : remkeys){
			SerialCalculatePool.queueUserWorkItem(()->{
        		this.collection.deleteMany(Filters.eq(keyField, kv));				
			});
		}		
		
		return list;
	}
	
	public List<Map<String, Object>> findValues(SortCond sort, FilterCond... conds){
		List<Bson> filist = new ArrayList<Bson>();
		List<Map<String, Object>> list = new LinkedList<Map<String, Object>>();
		FilterCond[] condsary = new FilterCond[0];
		if(conds != null && conds.length > 0){
			condsary = conds;
		}
		
		for(FilterCond cond : condsary){
			if(cond != null) {
				filist.add(cond.toBson());				
			}
		}
		Bson[] filters = new Bson[filist.size()];
		filist.toArray(filters);
		
		Bson filter = null;
		if(filters.length == 1){
			filter = filters[0];
		}else if(filters.length > 0){
			filter = Filters.and(filters);
		}
		
		FindIterable<Document> findIterable;
		if(filter == null) {
			findIterable = this.collection.find().sort(sort.toBson());
		}else {
			findIterable = this.collection.find(filter).sort(sort.toBson());
		}
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
        	Map<String, Object> resmap = documentToMap(doc);
        	list.add(resmap);
		}	
		
		return list;
	}
		
	public List<Map<String, Object>> findValues(int limit, FilterCond... conds){
		List<Bson> filist = new ArrayList<Bson>();
		List<Map<String, Object>> list = new LinkedList<Map<String, Object>>();
		FilterCond[] condsary = new FilterCond[0];
		if(conds != null && conds.length > 0){
			condsary = conds;
		}
		
		for(FilterCond cond : condsary){
			if(cond != null) {
				filist.add(cond.toBson());				
			}
		}
		Bson[] filters = new Bson[filist.size()];
		filist.toArray(filters);
		
		Bson filter = null;
		if(filters.length == 1){
			filter = filters[0];
		}else if(filters.length > 0){
			filter = Filters.and(filters);
		}
		
		List<Object> remkeys = new LinkedList<Object>();
		
		FindIterable<Document> findIterable;
		if(filter == null) {
			findIterable = this.collection.find().limit(limit);
		}else {
			findIterable = this.collection.find(filter).limit(limit);
		}
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	Object keyvalue = doc.get(valueField);
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remkeys.add(keyvalue);
            		continue;
            	}
            }
        	Map<String, Object> resmap = documentToMap(doc);
        	list.add(resmap);
		}	
		
		for(Object kv : remkeys){
			SerialCalculatePool.queueUserWorkItem(()->{
        		this.collection.deleteMany(Filters.eq(keyField, kv));				
			});
		}
		
		return list;
	}
	
	public List<Map<String, Object>> findValues(int limit, SortCond sort, FilterCond... conds){
		List<Bson> filist = new ArrayList<Bson>();
		List<Map<String, Object>> list = new LinkedList<Map<String, Object>>();
		FilterCond[] condsary = new FilterCond[0];
		if(conds != null && conds.length > 0){
			condsary = conds;
		}
		
		for(FilterCond cond : condsary){
			if(cond != null) {
				filist.add(cond.toBson());				
			}
		}
		Bson[] filters = new Bson[filist.size()];
		filist.toArray(filters);
		
		Bson filter = null;
		if(filters.length == 1){
			filter = filters[0];
		}else if(filters.length > 0){
			filter = Filters.and(filters);
		}
		
		List<Object> remkeys = new LinkedList<Object>();
		
		FindIterable<Document> findIterable;
		if(filter == null) {
			findIterable = this.collection.find().sort(sort.toBson()).limit(limit);
		}else {
			findIterable = this.collection.find(filter).sort(sort.toBson()).limit(limit);
		}
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	Object keyvalue = doc.get(valueField);
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remkeys.add(keyvalue);
            		continue;
            	}
            }
        	Map<String, Object> resmap = documentToMap(doc);
        	list.add(resmap);
		}	
		
		for(Object kv : remkeys){
			SerialCalculatePool.queueUserWorkItem(()->{
        		this.collection.deleteMany(Filters.eq(keyField, kv));				
			});
		}
		
		return list;
	}
	
	public void add(Map<String, Object> map){
		if(map == null || map.isEmpty()){
			return;
		}
		Document doc = mapToDocument(map);
		doc.append(ExpiresField, 0);
		this.collection.insertOne(doc);	
	}
	
	public void add(Map<String, Object> map, int timeoutInSec){
		if(map == null || map.isEmpty()){
			return;
		}
		Document doc = mapToDocument(map);
		doc.append(ExpiresField, timeoutInSec);
		doc.append(TimeField, System.currentTimeMillis());
		this.collection.insertOne(doc);		
	}
	
	public void setMap(Object key, Map<String, Object> map){
		if(map == null || map.isEmpty()){
			return;
		}
		map.remove("_id");
		Document doc = mapToDocument(map);
		if(!map.containsKey(keyField)){
			doc.append(keyField, key);
		}
		doc.append(ExpiresField, 0);
		Document setbson = new Document("$set", doc);
		
		UpdateResult res = this.collection.updateOne(Filters.eq(keyField, key), setbson);
		if(res.getModifiedCount() == 0 && !containsKey(key)){
			try{
				this.collection.insertOne(doc);
			}catch(Exception e){
				this.collection.updateOne(Filters.eq(keyField, key), setbson);
			}
		}
	}
	
	public void setMap(Object key, Map<String, Object> map, int timeoutInSec){
		if(map == null || map.isEmpty()){
			return;
		}
		map.remove("_id");
		Document doc = mapToDocument(map);
		if(!map.containsKey(keyField)){
			doc.append(keyField, key);
		}
		doc.append(ExpiresField, timeoutInSec);
		doc.append(TimeField, System.currentTimeMillis());
		Document setbson = new Document("$set", doc);
		
		UpdateResult res = this.collection.updateOne(Filters.eq(keyField, key), setbson);
		if(res.getModifiedCount() == 0 && !containsKey(key)){
			try{
				this.collection.insertOne(doc);
			}catch(Exception e){
				this.collection.updateOne(Filters.eq(keyField, key), setbson);
			}
		}
	}
	
	public Map<String, Object> getMap(Object key){
		FindIterable<Document> findIterable = this.collection.find(Filters.eq(keyField, key));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	long tm = doc.getLong(TimeField).longValue();
            	if(tm > 0 && System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remove(key);
            		mongoCursor.close();
            		return null;
            	}
            }
            Map<String, Object> obj = documentToMap(doc);
    		mongoCursor.close();
    		return obj;
        }
		if(mongoCursor != null){
			mongoCursor.close();
		}
		return null;		
	}
	
	public List<Map<String, Object>> getList(String field, Object fldKey){
		List<Object> remkeys = new LinkedList<Object>();
		
		List<Map<String, Object>> list = new LinkedList<Map<String, Object>>();
		FindIterable<Document> findIterable = this.collection.find(Filters.eq(field, fldKey));
		MongoCursor<Document> mongoCursor = findIterable.iterator(); 
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Integer expire = doc.getInteger(ExpiresField);
            if(expire != null && expire.intValue() != 0){
            	long tm = doc.getLong(TimeField).longValue();
            	if(System.currentTimeMillis() > tm + expire.intValue()*1000){
            		remkeys.add(fldKey);
            		continue;
            	}
            }
            Map<String, Object> obj = documentToMap(doc);
    		list.add(obj);
        }

		for(Object kv : remkeys){
			SerialCalculatePool.queueUserWorkItem(()->{
        		this.collection.deleteMany(Filters.eq(field, kv));				
			});
		}
		
		
		if(mongoCursor != null){
			mongoCursor.close();
		}
		return list;		
	}
		
	private Document mapToDocument(Map<String, Object> map){
		Document doc = new Document();
		for(Map.Entry<String, Object> entry : map.entrySet()){
			String key = entry.getKey();
			Object obj = entry.getValue();
			if(obj == null){
				doc.append(key, null);
				continue;
			}
			if(obj instanceof Map){
				Document objdoc = mapToDocument((Map<String, Object>)obj);
				doc.append(key, objdoc);
			}else if(obj instanceof String || obj instanceof BigInteger) {
				doc.append(key, obj.toString());
			}else if(obj instanceof Boolean) {
				boolean b = (boolean) obj;
				doc.append(key, b);
			}else if(obj instanceof Long || obj instanceof Integer || obj instanceof Short || obj instanceof Byte) {
				long n = ConvertUtility.getValueAsLong(obj);
				doc.append(key, n);
			}else if(obj instanceof Double || obj instanceof Float || obj instanceof BigDecimal) {
				double d = ConvertUtility.getValueAsDouble(obj);
				doc.append(key, d);
			}else if(obj instanceof Date) {
				String dt = FormatUtility.formatDateTime((Date)obj, "yyyy-MM-dd HH:mm:ss");
				doc.append(key, dt);
			}else if(obj instanceof LocalDateTime) {
				String dt = FormatUtility.formatDateTime((LocalDateTime)obj);
				doc.append(key, dt);
			}else if(obj instanceof Collection || obj.getClass().isArray()) {
				String json = JsonUtility.encode(obj);
				BsonArray ary = BsonArray.parse(json);
				doc.append(key, ary);
			}else{
				Class clzz = obj.getClass();
				try {
					Method m = clzz.getMethod("toMap");
					Map<String, Object> objmap = (Map<String, Object>)m.invoke(obj);
					Document objdoc = mapToDocument((Map<String, Object>)obj);
					doc.append(key, objdoc);
					continue;
				}catch (Exception e) {
				}
				if(clzz.isPrimitive()){
					doc.append(key, obj);
				}else if(obj instanceof String || obj instanceof Number){
					doc.append(key, obj);
				}else{
					try{
						String json = JsonUtility.encodePretty(obj);
						doc.append(key, Document.parse(json));
					}catch(Exception e){
						doc.append(key, obj.toString());
					}
				}
			}
		}
		return doc;
	}
	
	public Map<String, Object> getDistinct(String key) {
		Bson distinct = Filters.eq("distinct", this.collectionName);
		Bson keybson = Filters.eq("key", key);
		Bson cmd = Filters.and(distinct, keybson);
		Document doc = this.db.runCommand(cmd);
		Map<String, Object> map = this.documentToMap(doc);
		return map;
	}
	
	/**
	 * 返回分组的数据列表中为：
	 * {
	 * 	"count": 合计的数量,
	 * 	"_id": {
	 * 		"分组的key": key值
	 * 	}
	 * }
	 */
	public List<Map<String, Object>> aggregate(List<String> groupKeys, List<String> aggreKeys, Map<String, Object> matches){
		Document sub_group = new Document();
		Document grpflds = new Document();
		for(String key : groupKeys) {
			grpflds.put(key, "$" + key);
			
		}
		sub_group.put("_id", grpflds);
		sub_group.put("count", new Document("$sum", 1));
		if(aggreKeys != null) {
			for(String key : aggreKeys) {
				sub_group.put(key, new Document("$sum", "$" + key));
			}
		}
		
		Document sub_match = this.mapToDocument(matches);
		
		Document match = new Document("$match", sub_match);
		Document group = new Document("$group", sub_group);
		
		List<Document> aggregateList = new ArrayList<Document>();
		aggregateList.add(match);
		aggregateList.add(group);
		
		AggregateIterable<Document> resultset = collection.aggregate(aggregateList);
		MongoCursor<Document> mongoCursor = resultset.iterator();
		
		List<Map<String, Object>> list = new LinkedList<Map<String, Object>>();
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Map<String, Object> obj = documentToMap(doc);
    		list.add(obj);
        }
		
		return list;
	}
	
	/**
	 * 返回分组的数据列表中为：
	 * {
	 * 	"count": 合计的数量,
	 * 	"_id": {
	 * 		"分组的key": key值
	 * 	}
	 * }
	 */
	public List<Map<String, Object>> aggregate(List<String> groupKeys, List<String> aggreKeys, FilterCond... matches){
		Document sub_group = new Document();
		Document grpflds = new Document();
		for(String key : groupKeys) {
			grpflds.put(key, "$" + key);
			
		}
		sub_group.put("_id", grpflds);
		sub_group.put("count", new Document("$sum", 1));
		if(aggreKeys != null) {
			for(String key : aggreKeys) {
				sub_group.put(key, new Document("$sum", "$" + key));
			}
		}
		
		Document sub_match = new Document();
		for(FilterCond cond : matches) {
			if(cond != null) {
				Document doc = new Document(cond.getOp(), cond.getValue());
				sub_match.put(cond.getField(), doc);				
			}
		}
		
		Document match = new Document("$match", sub_match);
		Document group = new Document("$group", sub_group);
		
		List<Document> aggregateList = new ArrayList<Document>();
		aggregateList.add(match);
		aggregateList.add(group);
		
		AggregateIterable<Document> resultset = collection.aggregate(aggregateList);
		MongoCursor<Document> mongoCursor = resultset.iterator();
		
		List<Map<String, Object>> list = new LinkedList<Map<String, Object>>();
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Map<String, Object> obj = documentToMap(doc);
    		list.add(obj);
        }
		
		return list;
	}
	
	public long count(FilterCond... matches) {		
		if(matches == null || matches.length == 0) {
			return this.collection.estimatedDocumentCount();
		}
		return countValues(matches);
	}
	
	public long countTotal() {
		return this.collection.estimatedDocumentCount();
	}
	
	public void createIndex(String fld, boolean desc) {
		int asc = desc ? -1 : 1;
		Document idx = new Document(fld, asc);
		ListIndexesIterable<Document> list = this.collection.listIndexes();
		for(Document doc : list) {
			Object obj = doc.get(fld);
			Object obj1 = doc.get(String.format("%s_%d", fld, asc));
			if(obj1 != null || obj != null) {
				return;
			}
		}
		this.collection.createIndex(idx);
	}

	public List<Map<String, Object>> leftJoin(LookupCond[] lookups, int limit, SortCond sort) {
		List<Bson> aggregateList = new ArrayList<Bson>();
		for(LookupCond lookup : lookups){
			Bson lookupB = lookup.genLookup();
			aggregateList.add(lookupB);
			
			Bson nempty = LookupCond.getMatch(Arrays.asList(new FilterCond("$"+lookup.asField, CondOperator.Ne, new ArrayList<String>())));
			aggregateList.add(nempty);
		}

		if(sort != null){
			Bson sortB = sort.toBson();
			Document doc = new Document("$sort", sortB);
			aggregateList.add(doc);	
		}
		if(limit > 0){
			Document limitDoc = new Document("$limit", limit);
			aggregateList.add(limitDoc);	
		}
		
		if(statementLog) {
			String json = JsonUtility.encodePretty(aggregateList);
			log.debug("\n{}", json);
		}
		
		AggregateIterable<Document> resultset = this.collection.aggregate(aggregateList);
		MongoCursor<Document> mongoCursor = resultset.iterator();
		
		List<Map<String, Object>> list = new LinkedList<Map<String, Object>>();
		while(mongoCursor.hasNext()){  
            Document doc = mongoCursor.next();
            Map<String, Object> obj = documentToMap(doc);
    		list.add(obj);
        }
		
		return list;

	}
		
}
