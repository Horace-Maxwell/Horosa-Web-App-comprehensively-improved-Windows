package test.types;

import java.util.ArrayList;
import java.util.List;

import boundless.types.ConsistenceHash;
import boundless.types.IntPool;
import boundless.utility.RandomUtility;

public class ConsistenceHashTest {

	public ConsistenceHashTest() {

	}

	
	static int[] nodesId = new int[]{1, 2, 3, 4, 5, 6};
	
	static ConsistenceHash<String> hash = new ConsistenceHash<String>(nodesId,(count)->{
		return new String[count];
	});
	
	public static void main(String[] args){
				
		hash.addOnAvailable((nodeid, data) -> {
			System.out.println("============ node " + nodeid + " availabel ============");
			System.out.println("on it data: ");
			for(Object obj : data){
				System.out.println(obj);
			}
			System.out.println();
		});
		
		hash.addOnUnavailable((nodeid, data) -> {
			System.out.println("============ node " + nodeid + " unavailabel ============");
			System.out.println("on it with data: ");
			for(Object obj : data){
				System.out.println(obj);
			}
			System.out.println();
		});
		
		hash.addOnMigration((fromId, toId, data) -> {
			System.out.println("migrated data: ");
			for(Object obj : data){
				System.out.println(obj);
			}
			System.out.println("============ from node " + fromId + " to node " + toId +" ============");
			System.out.println(">>>>>>>>>>>>>>> current nodes state: <<<<<<<<<<<<<<<<<<<<<<<");
			printNodesState();
		});
		
		System.out.println("====================== init nodes ======================");
		List<String> list = new ArrayList<String>();
		for(int i=0; i<10; i++){
			String data = "data-" + i;
			list.add(data);
			int id = hash.putItem(data);
			System.out.println(data + " => on node " + id);
		}
		System.out.println("===============================================");
		System.out.println();
		

		test(hash, nodesId, null);
		
	}
	
	public static void test(ConsistenceHash<String> hash, int[] nodesId, Object obj){
		for(int id : nodesId){
			hash.setAvailable(id, true);
			System.out.println("==============================================================================================");
			System.out.println();
		}

		System.out.println("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
		System.out.println("++++++++++++++++++++++++++++ set nodes unavailable +++++++++++++++++++++++++++++++++++++++++++++++");
		System.out.println();
		
		for(int id : nodesId){
			hash.setAvailable(id, false);
			System.out.println("==============================================================================================");
			System.out.println();
		}
	}
	
	public static void printNodesState(){
		System.out.println(hash);
		System.out.println("-----------------------------------------------");
		System.out.println();
	}
	
}
