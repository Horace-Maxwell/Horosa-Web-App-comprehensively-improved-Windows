package test.model;

import boundless.model.HierarchicalMap;

public class TestHierarchicalMap {

	public static void main(String[] args){
		HierarchicalMap map = HierarchicalMap.createHierarchicalMap("/file/a 测试/app.xml");
		System.out.println(map);
	}
	
}
