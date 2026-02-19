package boundless.utility;

import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

/**
 * 字典实用类，以静态方法提供字典常用的功能
 * @author zjf
 *
 */
public class DictionaryUtility {

    public enum DictionaryFillType{
    	/**
    	 * 如果存在忽略
    	 */
    	Ignore(0), 
    	
    	/**
    	 * 如果存在覆盖
    	 */
    	Cover(1);
    	
    	private int _code;
    	private DictionaryFillType(int code){
    		this._code = code;
    	}
    	
    	public int getCode(){
    		return this._code;
    	}
    }

	/**
	 * 把another里的值填充到one
	 * @param one 
	 * @param another 
	 * @param fillType 字典填充方式
	 * @param ignoreKeys 忽略的字段
	 */
    public static <T_Key, T_Value> void fill(Map<T_Key, T_Value> one, Map<T_Key, T_Value> another, DictionaryFillType fillType, T_Key[] ignoreKeys)
    {
        Map<T_Key, Boolean> ignoreKeysHash = null;
        if (ignoreKeys != null && ignoreKeys.length > 0)
        {
            ignoreKeysHash = new HashMap<T_Key, Boolean>();
            for (T_Key item : ignoreKeys) ignoreKeysHash.put(item, true);
        }

        for (T_Key key : another.keySet())
        {
            if (ignoreKeysHash != null && ignoreKeysHash.containsKey(key)) continue;
            if (one.containsKey(key) && fillType==DictionaryFillType.Ignore) continue;
            one.put(key, another.get(key));
        }
    }

    /**
     * 合并
     * @param one
     * @param another
     * @return
     */
    public static <T_Key, T_Value> Map<T_Key, T_Value> Union(Map<T_Key, T_Value> one, Map<T_Key, T_Value> another)
    {
        Map<T_Key, T_Value> result = new HashMap<T_Key, T_Value>();
        for (Entry<T_Key, T_Value> item : one.entrySet())
        {
            result.put(item.getKey(), item.getValue());
        }

        for (Entry<T_Key, T_Value> item : another.entrySet())
        {
            if (!result.containsKey(item.getKey()))
            	result.put(item.getKey(), item.getValue()); 
        }
        
        return result;
    }

}
