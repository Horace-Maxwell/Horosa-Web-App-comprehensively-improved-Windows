package boundless.utility;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.io.output.NullWriter;

public class ListUtility {

	/**
	 * 合并
	 * @param one
	 * @param another
	 * @return
	 */
    public static <T> List<T> union(List<T> one, List<T> another)
    {
        return unionObjects(one, another.toArray());
    }

    /**
     * 合并
     * @param one
     * @param another
     * @return
     */
    public static <T> List<T> union(List<T> one, T[] another)
    {
        List<T> result = new ArrayList<T>();
        if (one != null) result.addAll(one);
        
        if (another != null)
        {
            Map<T, Boolean> dic = toDictionary(result);
            for(T item : another)
            {
                if (!dic.containsKey(item)) result.add(item);
            }
        }
        return result;
    }

    /**
     * 合并
     * @param one
     * @param another
     * @return
     */
    public static <T> List<T> unionObjects(List<T> one, Object[] another)
    {
        List<T> result = new ArrayList<T>();
        if (one != null) result.addAll(one);
        
        if (another != null)
        {
            Map<T, Boolean> dic = toDictionary(result);
            for(Object item : another)
            {
                if (!dic.containsKey(item)) result.add((T)item);
            }
        }
        return result;
    }

    public static <T> Map<T, Boolean> toDictionary(List<T> one)
    {
        Map<T, Boolean> dic = new HashMap<T, Boolean>();
        for (T e : one)
        {
            dic.put(e, true);
        }
        return dic;
    }
    
    /**
     * 判断列表是否不包含对象
     * @param lst
     * @return
     */
    public static <T> boolean IsEmpty(List<T> lst)
    {
    	if(lst == null){
    		return true;
    	}
    	
    	return lst.isEmpty();    		
    }

}
