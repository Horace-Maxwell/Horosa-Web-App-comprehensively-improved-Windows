package boundless.types.cache;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.types.cache.FilterCond.CondOperator;
import boundless.types.cache.SortCond.SortType;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.SecretRedactor;
import boundless.utility.StringUtility;

public class LocalDocumentCache implements ICache {

	private final String cacheName;
	private final String keyField;
	private final String valueField;
	private final Path storeFile;
	private final Map<String, Map<String, Object>> documents = new ConcurrentHashMap<String, Map<String, Object>>();
	private final Object lock = new Object();
	/** 落盘前脱敏(装请求记录的缓存开:交易日志等)。只作用于写进文件的副本,内存里的文档与读取路径不变。 */
	private final boolean redactOnPersist;

	public LocalDocumentCache(String cacheName, String keyField, String valueField, Path storeFile) {
		this(cacheName, keyField, valueField, storeFile, false);
	}

	public LocalDocumentCache(String cacheName, String keyField, String valueField, Path storeFile, boolean redactOnPersist) {
		this.cacheName = StringUtility.isNullOrEmpty(cacheName) ? "localcache" : cacheName;
		this.keyField = StringUtility.isNullOrEmpty(keyField) ? "_id" : keyField;
		this.valueField = StringUtility.isNullOrEmpty(valueField) ? "v" : valueField;
		this.storeFile = storeFile;
		this.redactOnPersist = redactOnPersist;
		load();
	}

	public boolean isRedactOnPersist() {
		return this.redactOnPersist;
	}

	@Override
	public void put(String key, Object value) {
		synchronized (lock) {
			Map<String, Object> doc = getExistingOrNew(normalizeKey(key));
			doc.put(this.keyField, key);
			doc.put(this.valueField, deepCopyValue(value));
			doc.put(MongoCache.ExpiresField, 0);
			doc.remove(MongoCache.TimeField);
			saveLocked();
		}
	}

	@Override
	public void put(String key, Object value, int timeToIdleSeconds, int timeToLiveSeconds) {
		synchronized (lock) {
			Map<String, Object> doc = getExistingOrNew(normalizeKey(key));
			doc.put(this.keyField, key);
			doc.put(this.valueField, deepCopyValue(value));
			doc.put(MongoCache.ExpiresField, timeToLiveSeconds);
			doc.put(MongoCache.TimeField, System.currentTimeMillis());
			saveLocked();
		}
	}

	@Override
	public Object get(String key) {
		synchronized (lock) {
			Map<String, Object> doc = getLiveDocLocked(normalizeKey(key));
			if(doc == null) {
				return null;
			}
			return deepCopyValue(doc.get(this.valueField));
		}
	}

	@Override
	public boolean containsKey(String key) {
		synchronized (lock) {
			return getLiveDocLocked(normalizeKey(key)) != null;
		}
	}

	@Override
	public long remove(String key) {
		synchronized (lock) {
			Map<String, Object> removed = documents.remove(normalizeKey(key));
			if(removed != null) {
				saveLocked();
				return 1;
			}
			return 0;
		}
	}

	@Override
	public void clear() {
		synchronized (lock) {
			documents.clear();
			saveLocked();
		}
	}

	@Override
	public String getRemoteCacheName() {
		return this.cacheName;
	}

	@Override
	public long remove(String field, Object value) {
		synchronized (lock) {
			long removed = 0;
			List<String> keys = new ArrayList<String>(documents.keySet());
			for(String key : keys) {
				Map<String, Object> doc = getLiveDocLocked(key);
				if(doc == null) {
					continue;
				}
				if(valuesEqual(doc.get(field), value)) {
					documents.remove(key);
					removed++;
				}
			}
			if(removed > 0) {
				saveLocked();
			}
			return removed;
		}
	}

	@Override
	public long remove(FilterCond... conds) {
		synchronized (lock) {
			long removed = 0;
			List<String> keys = new ArrayList<String>(documents.keySet());
			for(String key : keys) {
				Map<String, Object> doc = getLiveDocLocked(key);
				if(doc == null) {
					continue;
				}
				if(matchesAll(doc, conds)) {
					documents.remove(key);
					removed++;
				}
			}
			if(removed > 0) {
				saveLocked();
			}
			return removed;
		}
	}

	@Override
	public long removeMany(String partKey) {
		synchronized (lock) {
			String regex = wildcardToRegex(partKey);
			Pattern pattern = Pattern.compile(regex);
			long removed = 0;
			List<String> keys = new ArrayList<String>(documents.keySet());
			for(String key : keys) {
				Map<String, Object> doc = documents.get(key);
				if(doc == null) {
					continue;
				}
				Object fieldVal = doc.get(this.keyField);
				String text = fieldVal == null ? "" : fieldVal.toString();
				if(pattern.matcher(text).find()) {
					documents.remove(key);
					removed++;
				}
			}
			if(removed > 0) {
				saveLocked();
			}
			return removed;
		}
	}

	@Override
	public long removeAllByExpired(int n) {
		synchronized (lock) {
			long removed = 0;
			List<String> keys = new ArrayList<String>(documents.keySet());
			for(String key : keys) {
				Map<String, Object> doc = documents.get(key);
				if(doc == null) {
					continue;
				}
				Object exp = doc.get(MongoCache.ExpiresField);
				int expires = ConvertUtility.getValueAsInt(exp, 0);
				if(expires > n) {
					documents.remove(key);
					removed++;
				}
			}
			if(removed > 0) {
				saveLocked();
			}
			return removed;
		}
	}

	@Override
	public boolean containsKey(Object key) {
		return containsKey(normalizeKey(key));
	}

	@Override
	public long remove(Object key) {
		return remove(normalizeKey(key));
	}

	@Override
	public Object get(Object key) {
		return get(normalizeKey(key));
	}

	@Override
	public void put(Object key, Object value) {
		put(normalizeKey(key), value);
	}

	@Override
	public void putFieldValue(Object key, String field, Object value) {
		synchronized (lock) {
			String docKey = normalizeKey(key);
			Map<String, Object> doc = getExistingOrNew(docKey);
			doc.put(this.keyField, key);
			doc.put(field, deepCopyValue(value));
			saveLocked();
		}
	}

	@Override
	public long countValues(FilterCond... conds) {
		synchronized (lock) {
			return collectLocked(-1, null, conds).size();
		}
	}

	@Override
	public List<Map<String, Object>> findValues(FilterCond... conds) {
		synchronized (lock) {
			return collectLocked(-1, null, conds);
		}
	}

	@Override
	public List<Map<String, Object>> findValues(int limit, FilterCond... conds) {
		synchronized (lock) {
			return collectLocked(limit, null, conds);
		}
	}

	@Override
	public List<Map<String, Object>> findValues(SortCond sort, FilterCond... conds) {
		synchronized (lock) {
			return collectLocked(-1, sort, conds);
		}
	}

	@Override
	public List<Map<String, Object>> findValues(int limit, SortCond sort, FilterCond... conds) {
		synchronized (lock) {
			return collectLocked(limit, sort, conds);
		}
	}

	@Override
	public void add(Map<String, Object> map) {
		setMap(resolveMapKey(map), map);
	}

	@Override
	public void add(Map<String, Object> map, int timeoutInSec) {
		synchronized (lock) {
			Object key = resolveMapKey(map);
			Map<String, Object> doc = copyMap(map);
			doc.put(this.keyField, key);
			doc.put(MongoCache.ExpiresField, timeoutInSec);
			doc.put(MongoCache.TimeField, System.currentTimeMillis());
			documents.put(normalizeKey(key), doc);
			saveLocked();
		}
	}

	@Override
	public Map<String, Object> getMap(Object key) {
		synchronized (lock) {
			Map<String, Object> doc = getLiveDocLocked(normalizeKey(key));
			return doc == null ? null : copyMap(doc);
		}
	}

	@Override
	public List<Map<String, Object>> getList(String field, Object fldKey) {
		return findValues(new FilterCond(field, CondOperator.Eq, fldKey));
	}

	@Override
	public void setMap(Object key, Map<String, Object> map) {
		synchronized (lock) {
			Map<String, Object> doc = copyMap(map);
			doc.remove("_id");
			if(!doc.containsKey(this.keyField)) {
				doc.put(this.keyField, key);
			}
			doc.put(MongoCache.ExpiresField, 0);
			doc.remove(MongoCache.TimeField);
			documents.put(normalizeKey(doc.get(this.keyField)), doc);
			saveLocked();
		}
	}

	@Override
	public void setMap(Object key, Map<String, Object> map, int timeoutInSec) {
		synchronized (lock) {
			Map<String, Object> doc = copyMap(map);
			doc.remove("_id");
			if(!doc.containsKey(this.keyField)) {
				doc.put(this.keyField, key);
			}
			doc.put(MongoCache.ExpiresField, timeoutInSec);
			doc.put(MongoCache.TimeField, System.currentTimeMillis());
			documents.put(normalizeKey(doc.get(this.keyField)), doc);
			saveLocked();
		}
	}

	@Override
	public void createIndex(String fld, boolean desc) {
	}

	private Object resolveMapKey(Map<String, Object> map) {
		if(map != null && map.containsKey(this.keyField)) {
			return map.get(this.keyField);
		}
		return UUID.randomUUID().toString();
	}

	private List<Map<String, Object>> collectLocked(int limit, SortCond sort, FilterCond... conds) {
		cleanupExpiredLocked();
		List<Map<String, Object>> list = new ArrayList<Map<String, Object>>();
		for(Map<String, Object> doc : documents.values()) {
			if(matchesAll(doc, conds)) {
				list.add(copyMap(doc));
			}
		}
		if(sort != null) {
			list.sort(buildComparator(sort));
		}
		if(limit > 0 && list.size() > limit) {
			return new ArrayList<Map<String, Object>>(list.subList(0, limit));
		}
		return list;
	}

	private Comparator<Map<String, Object>> buildComparator(SortCond sort) {
		Comparator<Map<String, Object>> comparator = (left, right) -> compareValues(left.get(sort.getField()), right.get(sort.getField()));
		if(sort.getSort() == SortType.Desc) {
			comparator = comparator.reversed();
		}
		SortCond[] others = sort.getOthers();
		if(others != null) {
			for(SortCond other : others) {
				if(other != null) {
					comparator = comparator.thenComparing(buildComparator(other));
				}
			}
		}
		return comparator;
	}

	private boolean matchesAll(Map<String, Object> doc, FilterCond... conds) {
		if(conds == null || conds.length == 0) {
			return true;
		}
		for(FilterCond cond : conds) {
			if(cond != null && !matches(doc, cond)) {
				return false;
			}
		}
		return true;
	}

	private boolean matches(Map<String, Object> doc, FilterCond cond) {
		if(cond instanceof FilterOrCond) {
			for(FilterCond child : ((FilterOrCond)cond).getConds()) {
				if(matches(doc, child)) {
					return true;
				}
			}
			return false;
		}
		if(cond instanceof FilterAndCond) {
			for(FilterCond child : ((FilterAndCond)cond).getConds()) {
				if(!matches(doc, child)) {
					return false;
				}
			}
			return true;
		}
		String field = cond.getField();
		Object expected = cond.getValue();
		Object actual = doc.get(field);
		CondOperator op = cond.getOperator();
		switch(op) {
		case Eq:
			return valuesEqual(actual, expected);
		case Ne:
			return !valuesEqual(actual, expected);
		case Lt:
			return compareValues(actual, expected) < 0;
		case Lte:
			return compareValues(actual, expected) <= 0;
		case Gt:
			return compareValues(actual, expected) > 0;
		case Gte:
			return compareValues(actual, expected) >= 0;
		case In:
			return containsValue(expected, actual);
		case Like:
			return matchesPattern(actual, expected);
		case Exists:
			return doc.containsKey(field) == ConvertUtility.getValueAsBool(expected, false);
		default:
			return false;
		}
	}

	private boolean containsValue(Object collectionLike, Object actual) {
		if(collectionLike instanceof Collection<?>) {
			for(Object item : (Collection<?>) collectionLike) {
				if(valuesEqual(actual, item)) {
					return true;
				}
			}
			return false;
		}
		if(collectionLike != null && collectionLike.getClass().isArray()) {
			Object[] arr = (Object[]) collectionLike;
			for(Object item : arr) {
				if(valuesEqual(actual, item)) {
					return true;
				}
			}
			return false;
		}
		return valuesEqual(actual, collectionLike);
	}

	private boolean matchesPattern(Object actual, Object expected) {
		if(actual == null) {
			return false;
		}
		String text = actual.toString();
		if(expected instanceof Pattern) {
			return ((Pattern) expected).matcher(text).find();
		}
		if(expected == null) {
			return false;
		}
		return Pattern.compile(expected.toString()).matcher(text).find();
	}

	private int compareValues(Object left, Object right) {
		if(left == null && right == null) {
			return 0;
		}
		if(left == null) {
			return -1;
		}
		if(right == null) {
			return 1;
		}
		Double leftNum = toNumber(left);
		Double rightNum = toNumber(right);
		if(leftNum != null && rightNum != null) {
			return Double.compare(leftNum, rightNum);
		}
		return left.toString().compareTo(right.toString());
	}

	private Double toNumber(Object value) {
		if(value instanceof Number) {
			return ((Number) value).doubleValue();
		}
		try {
			return Double.parseDouble(value.toString());
		}catch(Exception e) {
			return null;
		}
	}

	private boolean valuesEqual(Object left, Object right) {
		if(left == null || right == null) {
			return left == right;
		}
		Double leftNum = toNumber(left);
		Double rightNum = toNumber(right);
		if(leftNum != null && rightNum != null) {
			return Double.compare(leftNum, rightNum) == 0;
		}
		return left.equals(right) || left.toString().equals(right.toString());
	}

	private Map<String, Object> getExistingOrNew(String key) {
		Map<String, Object> doc = documents.get(key);
		if(doc == null) {
			doc = new LinkedHashMap<String, Object>();
			documents.put(key, doc);
		}
		return doc;
	}

	private Map<String, Object> getLiveDocLocked(String key) {
		Map<String, Object> doc = documents.get(key);
		if(doc == null) {
			return null;
		}
		if(isExpired(doc)) {
			documents.remove(key);
			saveLocked();
			return null;
		}
		return doc;
	}

	private void cleanupExpiredLocked() {
		List<String> expired = new ArrayList<String>();
		for(Map.Entry<String, Map<String, Object>> entry : documents.entrySet()) {
			if(isExpired(entry.getValue())) {
				expired.add(entry.getKey());
			}
		}
		if(!expired.isEmpty()) {
			for(String key : expired) {
				documents.remove(key);
			}
			saveLocked();
		}
	}

	private boolean isExpired(Map<String, Object> doc) {
		int expires = ConvertUtility.getValueAsInt(doc.get(MongoCache.ExpiresField), 0);
		if(expires <= 0) {
			return false;
		}
		long tm = ConvertUtility.getValueAsLong(doc.get(MongoCache.TimeField), 0L);
		return tm > 0 && System.currentTimeMillis() > tm + expires * 1000L;
	}

	private Map<String, Object> copyMap(Map<String, Object> map) {
		if(map == null) {
			return null;
		}
		return JsonUtility.toDictionary(JsonUtility.encode(map));
	}

	private Object deepCopyValue(Object value) {
		if(value == null) {
			return null;
		}
		if(value instanceof Map<?, ?> || value instanceof List<?>) {
			return JsonUtility.decode(JsonUtility.encode(value), Object.class);
		}
		return value;
	}

	private String normalizeKey(Object key) {
		return key == null ? "" : key.toString();
	}

	private String wildcardToRegex(String value) {
		if(StringUtility.isNullOrEmpty(value)) {
			return ".*";
		}
		StringBuilder sb = new StringBuilder();
		for(char ch : value.toCharArray()) {
			if(ch == '*') {
				sb.append(".*");
			}else if("\\.^$|?+()[]{}".indexOf(ch) >= 0) {
				sb.append('\\').append(ch);
			}else {
				sb.append(ch);
			}
		}
		return sb.toString();
	}

	private void load() {
		synchronized (lock) {
			documents.clear();
			if(storeFile == null || !Files.exists(storeFile)) {
				return;
			}
			try {
				String json = Files.readString(storeFile, StandardCharsets.UTF_8);
				if(StringUtility.isNullOrEmpty(json)) {
					return;
				}
				Map<String, Object> root = JsonUtility.toDictionary(json);
				Object docsObj = root.get("docs");
				if(!(docsObj instanceof List<?>)) {
					return;
				}
				boolean plaintextOnDisk = false;
				for(Object item : (List<?>) docsObj) {
					if(!(item instanceof Map<?, ?>)) {
						continue;
					}
					Map<String, Object> doc = copyMap((Map<String, Object>) item);
					Object key = doc.get(this.keyField);
					if(key != null) {
						documents.put(normalizeKey(key), doc);
						if(this.redactOnPersist && !plaintextOnDisk && SecretRedactor.redactRecord(doc, null, this.keyField) != doc) {
							plaintextOnDisk = true;
						}
					}
				}
				// 旧版本写下的明文密钥:读入时就回写一次脱敏版(不等下一次写盘 —— 桌面版交易日志不写盘,等不到)
				if(plaintextOnDisk) {
					saveLocked();
				}
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		}
	}

	/** 要写进文件的文档列表:开了落盘脱敏就逐条过 SecretRedactor(单源;主键字段不按名字掩,写时复制)。旧版本写下的记录也在下一次写盘时一并脱敏。 */
	private List<Map<String, Object>> persistDocsLocked() {
		List<Map<String, Object>> docs = new ArrayList<Map<String, Object>>(documents.size());
		for(Map<String, Object> doc : documents.values()) {
			docs.add(this.redactOnPersist ? SecretRedactor.redactRecord(doc, null, this.keyField) : doc);
		}
		return docs;
	}

	private void saveLocked() {
		if(storeFile == null) {
			return;
		}
		try {
			Files.createDirectories(storeFile.getParent());
			Map<String, Object> root = new LinkedHashMap<String, Object>();
			root.put("cacheName", this.cacheName);
			root.put("keyField", this.keyField);
			root.put("valueField", this.valueField);
			root.put("docs", persistDocsLocked());
			String json = JsonUtility.encode(root);
			Path tmp = storeFile.resolveSibling(storeFile.getFileName().toString() + ".tmp");
			Files.writeString(tmp, json, StandardCharsets.UTF_8);
			try {
				Files.move(tmp, storeFile, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
			}catch(AtomicMoveNotSupportedException ex) {
				Files.move(tmp, storeFile, StandardCopyOption.REPLACE_EXISTING);
			}
		}catch(IOException | RuntimeException | StackOverflowError e) {
			// 写不进 / 某条记录序列化或脱敏出错:记日志,这一次不落盘;不让异常冒到调用方的业务请求里
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
	}
}
