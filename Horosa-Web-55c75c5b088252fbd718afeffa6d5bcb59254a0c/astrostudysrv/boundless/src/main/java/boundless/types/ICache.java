package boundless.types;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.exception.UnimplementedException;
import boundless.types.cache.FilterCond;
import boundless.types.cache.SortCond;
import boundless.utility.ConvertUtility;
import boundless.types.cache.LookupCond;

public interface ICache {
	public static final Logger log = LoggerFactory.getLogger(ICache.class);
	
	public void put(String key, Object value);
	public Object get(String key);
	public boolean containsKey(String key);
	public long remove(String key);
	public void clear();
	
	default public void close(){}
	default public void put(String key, Object value, int timeToLiveSeconds){ put(key, value, 0, timeToLiveSeconds); };
	default public void put(String key, Object value, long timeToLiveSeconds){ put(key, value, 0, (int)timeToLiveSeconds); };
	
	default public void put(String key, Object value, int timeToIdleSeconds, int timeToLiveSeconds){ throw new UnimplementedException("Unimplemented"); };
	default public void put(String key, Object value, long timeToIdleSeconds, long timeToLiveSeconds){ put(key, value, (int)timeToIdleSeconds, (int)timeToLiveSeconds); };
	
	default public long remove(String field, Object value){ throw new UnimplementedException("Unimplemented"); };
	default public long remove(FilterCond cond){ throw new UnimplementedException("Unimplemented"); };
	default public long remove(FilterCond... conds){ throw new UnimplementedException("Unimplemented"); };
	default public long removeMany(String partKey){ throw new UnimplementedException("Unimplemented"); };
	default public long remove(String fld, String value){ throw new UnimplementedException("Unimplemented"); };
	default public long remove(String fld, long value){ throw new UnimplementedException("Unimplemented"); };
	default public long remove(String fld, int value){ throw new UnimplementedException("Unimplemented"); };
	default public long removeAllByExpired(int n){ throw new UnimplementedException("Unimplemented"); };
	default public String getRemoteCacheName(){ throw new UnimplementedException("Unimplemented"); };
	default public long countKey(String partKey){ throw new UnimplementedException("Unimplemented"); };
	default public Map<String, Object> getMany(String partKey){ return new HashMap<String, Object>(); };
	default public Object get(String key, String field){ throw new UnimplementedException("Unimplemented"); }
	default public Map<String, Object> getFieldsValue(String key, String... fields){ throw new UnimplementedException("Unimplemented"); }
	default public Map<String, Object> getFieldsValue(Object key, String... fields){ throw new UnimplementedException("Unimplemented"); }
	default public void putFieldValue(String key, String field, Object value){ throw new UnimplementedException("Unimplemented"); }
	
	default public long lpush(String key, final String... strings){ throw new UnimplementedException("Unimplemented"); }
	default public String lpop(String key){ throw new UnimplementedException("Unimplemented"); }
	default public long rpush(String key, final String... strings){ throw new UnimplementedException("Unimplemented"); }
	default public String rpop(String key){ throw new UnimplementedException("Unimplemented"); }
	default public List<String> lrang(final String key, final long start, final long end){ throw new UnimplementedException("Unimplemented"); }
	default public Long llen(final String key){ throw new UnimplementedException("Unimplemented"); }
	default public Long expire(final String key, final int seconds){ throw new UnimplementedException("Unimplemented"); }
	default public Long expireAt(final String key, final long unixTime){ throw new UnimplementedException("Unimplemented"); }
	default public Long publish(final String channel, final String message){ throw new UnimplementedException("Unimplemented"); }
	default public Set<String> zrangeByScore(final String key, final double min, final double max, final int offset, final int count){ throw new UnimplementedException("Unimplemented"); }
	default public Set<byte[]> zrangeByScore(final byte[] key, final double min, final double max, final int offset, final int count) {throw new UnimplementedException("Unimplemented"); }
	default public Long zadd(final String key, final double score, final String member){ throw new UnimplementedException("Unimplemented"); }
	default public double zincrby(final String key, final double score, final String member){ throw new UnimplementedException("Unimplemented"); }
	
	default public long inc(String key, long value){
		long v = ConvertUtility.getValueAsLong(get(key));
		v += value;
		put(key, v);
		return v;
	}
	
	default public long dec(String key, long value){
		long v = ConvertUtility.getValueAsLong(get(key));
		v -= value;
		put(key, v);
		return v;
	}
	
	default public long inc(String key){
		return inc(key, 1L);
	}
	
	default public long dec(String key){
		return dec(key, 1L);
	}
	
	default public Object getHash(String map, String key){ throw new UnimplementedException("Unimplemented"); }
	default public void putHash(String map, String key, Object value){ throw new UnimplementedException("Unimplemented"); }

	default public long size(){ throw new UnimplementedException("Unimplemented"); }
	default public void forAll(Consumer<Map<String, Object>> consumer, String... fields){ throw new UnimplementedException("Unimplemented"); }

	default public long count(String key, String partValue){ throw new UnimplementedException("Unimplemented"); }
	default public long count(String key, long value){ throw new UnimplementedException("Unimplemented"); }
	default public long countTotal(){ throw new UnimplementedException("Unimplemented"); }

	default public boolean containsKey(Object key){ throw new UnimplementedException("Unimplemented"); }
	default public Object get(Object key){ throw new UnimplementedException("Unimplemented"); }
	default public void put(Object key, Object value){ throw new UnimplementedException("Unimplemented"); }
	default public void putFieldValue(Object key, String field, Object value){ throw new UnimplementedException("Unimplemented"); }
	default public long remove(Object key){ throw new UnimplementedException("Unimplemented"); }
	
	default public long countValues(FilterCond... conds){ throw new UnimplementedException("Unimplemented"); }
	default public List<Map<String, Object>> findValues(FilterCond... conds){ throw new UnimplementedException("Unimplemented"); }
	default public List<Map<String, Object>> findValues(int limit, FilterCond... conds){ throw new UnimplementedException("Unimplemented"); }
	default public List<Map<String, Object>> findValues(SortCond sort, FilterCond... conds){ throw new UnimplementedException("Unimplemented"); }
	default public List<Map<String, Object>> findValues(int limit, SortCond sort, FilterCond... conds){ throw new UnimplementedException("Unimplemented"); }
	default public void add(Map<String, Object> map){ throw new UnimplementedException("Unimplemented"); }
	default public void add(Map<String, Object> map, int timeoutInSec){ throw new UnimplementedException("Unimplemented"); }
	default public Map<String, Object> getMap(Object key){ throw new UnimplementedException("Unimplemented"); }
	default public List<Map<String, Object>> getList(String field, Object fldKey){ throw new UnimplementedException("Unimplemented"); }
	default public void setMap(Object key, Map<String, Object> map){ throw new UnimplementedException("Unimplemented"); }
	default public void setMap(Object key, Map<String, Object> map, int timeoutInSec){ throw new UnimplementedException("Unimplemented"); }

	default public ICache spawnCache(String dataSetName){ return this; }
	default public void dropDataSet(){}
	
	default public Map<String, Object> getDistinct(String key){ throw new UnimplementedException("Unimplemented"); }
	default public List<Map<String, Object>> aggregate(List<String> groupKeys,List<String> aggreKeys, Map<String, Object> matches){ throw new UnimplementedException("Unimplemented"); }
	default public List<Map<String, Object>> aggregate(List<String> groupKeys,List<String> aggreKeys,FilterCond... matches){ throw new UnimplementedException("Unimplemented"); }
	default public long count(FilterCond... matches){ throw new UnimplementedException("Unimplemented"); }
	default public void createIndex(String fld, boolean desc){ throw new UnimplementedException("Unimplemented"); }
	default public void createIndex(String fld){ this.createIndex(fld, false); }

	default public List<Map<String, Object>> leftJoin(LookupCond[] lookups, int limit, SortCond sort){ throw new UnimplementedException("Unimplemented"); }
}
