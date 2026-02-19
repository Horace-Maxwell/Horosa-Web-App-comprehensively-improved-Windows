package test.utility;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.utility.ConvertUtility;

public class ConvertUtilityTest {

	public static void main(String[] args){
		Map map = new HashMap();
		
		map.put("key1", "value1");
		map.put("key2", new String[]{ "str1", "str2", "str3" });
		
		String[] strary = new String[]{ "str1", "str2", "str3" };
		System.out.println(ConvertUtility.getValueAsString(strary));
		
		String res = ConvertUtility.getValueAsString(map);
		System.out.println(res);	
		
		int[] ns = new int[]{ 1, 2, 3, 4, 6 };
		System.out.println(ConvertUtility.getValueAsString(ns));	
		
		Map map1 = new HashMap(); map1.put("key", "value");
		Map map2 = new HashMap(); map2.put("key", "value");
		Map map3 = new HashMap(); map3.put("key", "value");
		Map[] maps = new HashMap[3];
		maps[0] = map1;
		maps[1] = map2;
		maps[2] = map3;
		System.out.println(ConvertUtility.getValueAsString(maps));	
		
		List list = new ArrayList();
		list.add("str1");
		list.add("str2");
		list.add("str3");
		System.out.println(ConvertUtility.getValueAsString(list));	
	}
	
}
