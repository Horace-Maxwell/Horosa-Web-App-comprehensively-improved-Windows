package test.utility;

import java.nio.charset.Charset;
import java.util.HashMap;

import boundless.utility.*;

import com.google.gson.annotations.SerializedName;

public class JsonUtilityTest {
	
	public static void test(User user, Object obj){
		long start = System.currentTimeMillis();
		String json = null;
		for(int i=0; i<100; i++){
			JsonUtility.encode(user);
		}
		System.out.println(obj + " encode total time: "+ (System.currentTimeMillis() - start));
		
		
		json = JsonUtility.encode(user);
		long decStart = System.currentTimeMillis();
		for(int i=0; i<100; i++){
			JsonUtility.decode(json, User.class);
		}
		System.out.println(obj + " decode total time: "+ (System.currentTimeMillis() - decStart));
		
	}
	
	public static void main(String args[]) throws Throwable {
		 
		User user=new User();
		user.setId("U01");
		user.setName("张三");
		user.setSex("男");
		user.setAge(20);
		
		String jsonStr=JsonUtility.encode(user);
		System.out.println("user:"+jsonStr);
		
		user=(User)JsonUtility.decode(jsonStr, User.class);
		System.out.println("id:"+user.getId()+",name:"+user.getName()+",age:"+user.getAge()+",sex:"+user.getSex());
		
		final User user1 = user;		
		for(int i=0; i<50; i++){
			CalculatePool.queueUserWorkItem(Integer.valueOf(i), (obj)->{
				System.out.println("================================ thread " + obj +" start ================================");
				test(user1, "thread " + obj + " ");
				System.out.println("================================ thread " + obj +" end ================================");
			}, (e)->{
				e.printStackTrace();
			});			
		}

		HashMap<String, Object> map=new HashMap<String,Object>();
		map.put("user", user);
		
		HashMap<String, Object> subMap=new HashMap<String,Object>();
		subMap.put("type", 1);
		map.put("tl", subMap);
		
		System.out.println("map:"+JsonUtility.encode(map));
	}
	
}

class User{
	@SerializedName("id")
	private String _id;
	
	@SerializedName("name")
	private String _name;
	
	@SerializedName("sex")
	private String _sex;
	
	@SerializedName("age")
	private int _age;
	
	public String getId(){
		return _id;
	}
	public void setId(String value){
		_id=value;
	}
	
	public String getName(){
		return _name;
	}
	public void setName(String value){
		_name=value;
	}
	
	public String getSex(){
		return _sex;
	}
	public void setSex(String value){
		_sex=value;
	}
	
	public int getAge(){
		return _age;
	}
	public void setAge(int value){
		_age=value;
	}
}
