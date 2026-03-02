package boundless.utility;

import java.util.ArrayList;
import java.util.List;

/**
 * 数组实用类，以静态方法提供数组常用的功能
 * @author zjf
 *
 */
public class ArrayUtility {

	/**
	 * 判断数组中是否存在某个元素
	 * @param values 数组
	 * @param one 要判断的元素
	 * @return
	 */
    public static <T> boolean containsGeneral(T[] values, T one)
    {        
        for (int i = 0; i < values.length; i++)
        {
        	if(one == null && values[i] == null) return true;
        	if((one == null && values[i] != null) || (one != null && values[i] == null)) continue;
        	
            if (one == values[i] || one.equals(values[i])) return true;
        }
        return false;
    }
    
	/**
	 * 判断数组中是否存在某个元素
	 * @param values 数组
	 * @param one 要判断的元素
	 * @return
	 */
    public static boolean contains(Object[] values, Object one){
        String[] strValues = ConvertUtility.toString(values);
        String strOne = ConvertUtility.getValueAsString(one);
        for (int i = 0; i < strValues.length; i++)
        {
            if (strOne.equals(strValues[i])) return true;
        }
        return false;
    	
    }
    
    
	/**
	 * 判断数组中是否存在某个元素
	 * @param values 数组
	 * @param one 要判断的元素
	 * @return
	 */
    public static boolean contains(byte[] values, byte one)
    {
        for (int i = 0; i < values.length; i++)
        {
            if (one == values[i]) return true;
        }
        return false;
    }
    
    /**
     * 合并两个字符串数组
     * @param one 数组1
     * @param another 数组2
     * @return 返回合并后的数组
     */
    public static String[] union(String[] one, String[] another)
    {
        List<String> list =  unionGeneral(one, another);
        String[] res = new String[list.size()];
        return list.toArray(res);
    }
    

    /**
     * 合并两个数组
     * @param one
     * @param another
     * @return 合并后的列表对象
     */
    public static <T> List<T> unionGeneral(T[] one, T[] another)
    {
        List<T> list = new ArrayList<T>();
        for (int i = 0; i < one.length; i++)
        {
            if (!list.contains(one[i])) list.add(one[i]);
        }

        for (int i = 0; i < another.length; i++)
        {
            if (!list.contains(another[i])) list.add(another[i]);
        }

        return list;
    }

    
    public static void main(String[] args){
    	String[] ary1 = new String[]{"1", "2", "3"};
    	String[] ary2 = new String[]{"a", "b", "c"};
    	String[] res = union(ary1, ary2);
    	for(String str : res){
    		System.out.println(str);
    	}
    }
    
}
