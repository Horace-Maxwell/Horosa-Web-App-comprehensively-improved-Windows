package boundless.utility;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Type;
import java.net.URL;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import boundless.io.FileUtility;
import boundless.types.Jsonable;


public class JsonUtility {

	public static class AllowCommentsJsonFactory extends JsonFactory {
		private static final long serialVersionUID = -5267854864809980234L;

		@Override
	    public JsonParser createParser(URL url) throws IOException, JsonParseException {
			JsonParser p = super.createParser(url);
			p.enable(JsonParser.Feature.ALLOW_COMMENTS);
			return p;
	    }
		
		@Override
	    public JsonParser createParser(String str) throws IOException, JsonParseException {
			JsonParser p = super.createParser(str);
			p.enable(JsonParser.Feature.ALLOW_COMMENTS);
			return p;
	    }
		
		@Override
	    public JsonParser createParser(File file) throws IOException, JsonParseException {
			JsonParser p = super.createParser(file);
			p.enable(JsonParser.Feature.ALLOW_COMMENTS);
			return p;
	    }
		
	}
	
	private static DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
	
	private static GsonBuilder gsonBuilder;
	private static Gson gson;

	private static ObjectMapper jsonMapper = new ObjectMapper(new AllowCommentsJsonFactory()); 

	static{
		gsonBuilder = new GsonBuilder();
		gsonBuilder.setDateFormat("yyyy-MM-dd HH:mm:ss");
		gsonBuilder.disableHtmlEscaping();
		gson = gsonBuilder.setPrettyPrinting().create();

		jsonMapper.registerModule(new JavaTimeModule());
		jsonMapper.setDateFormat(dateFormat);
		jsonMapper.setVisibility(jsonMapper.getSerializationConfig().getDefaultVisibilityChecker()
                .withFieldVisibility(Visibility.ANY)
                .withGetterVisibility(Visibility.NONE)
                .withIsGetterVisibility(Visibility.NONE)
                .withSetterVisibility(Visibility.NONE)
                .withCreatorVisibility(Visibility.NONE));			

	}
	
    public static Map<String, Object> toDictionary(String jsonStr) 
    {
//    	Type type = new TypeToken<Map<String, Object>>() {}.getType();
		return decode(jsonStr, Map.class);
    }

    public static Map<String, Object>[] toDictionaryArray(String jsonStr)
    {
//    	Type type = new TypeToken<Map<String, Object>[]>() {}.getType();
		return decode(jsonStr, Map[].class);
    }    

    
    /**
     * 把对象转换为json字符串
     * @param obj
     * @return
     */
    public static String encode(Object obj)
    {
    	try{
        	String res = null;
        	if(obj instanceof Jsonable){
//        		res = gson.toJson(((Jsonable)obj).toMapOrList());
        		res = jsonMapper.writeValueAsString(((Jsonable)obj).toMapOrList());
        	}else{
//            	res = gson.toJson(obj);
            	res = jsonMapper.writeValueAsString(obj);
        	}
        	if(res != null && res.equalsIgnoreCase("null")){
        		return "";
        	}
        	return res;
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static String encodePretty(Object obj){
    	try{
    		String res = null;
        	if(obj instanceof Jsonable){
        		res = jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsString(((Jsonable)obj).toMapOrList());
        	}else{
            	res = jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        	}
        	if(res != null && res.equalsIgnoreCase("null")){
        		return "";
        	}
        	return res;
    	}catch(Exception e){
    		throw new RuntimeException(e);
    	}
    }
    
    public static String encode(Object obj, String dateFormatStr){    	
    	DateFormat df = new SimpleDateFormat(dateFormatStr);
    	ObjectMapper mapper = new ObjectMapper(new AllowCommentsJsonFactory()); 
		mapper.setDateFormat(df);
		mapper.setVisibility(mapper.getSerializationConfig().getDefaultVisibilityChecker()
                .withFieldVisibility(Visibility.ANY)
                .withGetterVisibility(Visibility.NONE)
                .withSetterVisibility(Visibility.NONE)
                .withCreatorVisibility(Visibility.NONE));			

		try{
	    	String res = null;
	    	if(obj instanceof Jsonable){
	    		res = mapper.writeValueAsString(((Jsonable)obj).toMapOrList());
	    	}else{
	    		res = mapper.writeValueAsString(obj);
	    	}
	    	if(res != null && res.equalsIgnoreCase("null")){
	    		return "";
	    	}
	    	return res;
		}catch(Exception e){
			throw new RuntimeException(e);
		}
    }
    


    /**
     * 把json字符串转换为对象
     * @param s json字符串
     * @param class1 需要转换成的对象类
     * @return
     */
    public static <T> T decode(String s, Class<T> class1) {
//    	Gson tmpgson = gsonBuilder.create();
//    	return tmpgson.fromJson(s, class1);
    	
    	try {
    		return jsonMapper.readValue(s, class1);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
    }
    
    public static <T> List<T> decodeList(String s, Class<T> itemclz){
    	try {
    		JavaType type = jsonMapper.getTypeFactory().constructCollectionType(List.class, itemclz);
        	List<T> result = jsonMapper.readValue(s, type);
        	return result;
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
    }
    
    public static <T> Set<T> decodeSet(String s, Class<T> itemclz){
    	try {
    		JavaType type = jsonMapper.getTypeFactory().constructCollectionType(Set.class, itemclz);
        	Set<T> result = jsonMapper.readValue(s, type);
        	return result;
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
    }
    
    public static <T> T decode(String s, Type type){
    	Gson tmpgson = gsonBuilder.create();
    	return tmpgson.fromJson(s, type);
    }

    public static <T> T decode(String s, Class<T> class1, String dtFormat) {
    	dtFormat = FormatUtility.convertFormat(dtFormat);
//    	GsonBuilder tmpBuilder = new GsonBuilder();
//    	tmpBuilder.setDateFormat(dateFormat);
//    	tmpBuilder.disableHtmlEscaping();
//    	
//    	return tmpBuilder.create().fromJson(s, class1);
    	
   		try {
			return jsonMapper.readValue(s, class1);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
    }


    public static <T> T decodeFromClassPath(String classpath, Class<T> class1){
    	String json = FileUtility.getStringFromClassPath(classpath);
    	return decode(json, class1);
    }
    
    public static <T> T decodeFromFilePath(String filepath, Class<T> class1){
    	String json = FileUtility.getStringFromFile(filepath);
    	return decode(json, class1);
    }
    
    public static <T> List<T> decodeListFromClassPath(String classpath, Class<T> itemclz){
    	String json = FileUtility.getStringFromClassPath(classpath);
    	return decodeList(json, itemclz);
    }
    
    public static <T> List<T> decodeListFromFilePath(String file, Class<T> itemclz){
    	String json = FileUtility.getStringFromFile(file);
    	return decodeList(json, itemclz);
    }
    
    public static void main(String[] args){
    	Map map = new HashMap();
    	map.put("date", new Date());
    	
    	Runnable run = new Runnable(){
    		public String member1 = "public...1...";
    		
    		public String getMember1(){
    			return "...1...";
    		}
    		
    		public String getMember1(String flag){
    			return "...11...";
    		}
    		
    		public boolean isTest(){
    			return true;
    		}
    		
    		public void setMember1(String flag){
    			System.out.println("setMember1");
    		}
    		
			@Override
			public void run() {				
			}
    	};
    	
    	map.put("test", run);
    	List list = new ArrayList();
    	for(int i=0; i<10; i++){
    		Map tmp = new HashMap();
    		tmp.put("name", "tmp" + i);
    		list.add(tmp);
    	}
    	
    	map.put("List", list);
    	
    	int[] intary = new int[]{1,2,3,4,5,6};
    	map.put("IntAry", intary);
    	
    	Map[] mapary = new HashMap[10];
    	for(int i=0; i<10; i++){
    		mapary[i] = new HashMap();
    		mapary[i].put("mapname", "map" + i);
    	}
    	map.put("MapAry", mapary);
    	
    	Integer[] intobjary = new Integer[]{Integer.valueOf(0),Integer.valueOf(1),Integer.valueOf(2),Integer.valueOf(3)};
    	map.put("IntegerAry", intobjary);
    	
    	Character[] charobjary = new Character[]{Character.valueOf('a'),Character.valueOf('b'),
    			Character.valueOf('c'),Character.valueOf('d')};
    	map.put("CharAry", charobjary);
    	
    	TestAccount account = new TestAccount();
    	account.setName("aaa");
    	account.setAddress("address1");
    	account.setEmail("aaa@aaa.com");
    	account.setId(100);
    	
    	List<TestAccount> actlist = new LinkedList<TestAccount>();
    	for(int i=0; i<10; i++){
    		actlist.add(account);
    	}
    	String actlistjson = encode(actlist);
    	
		Type type = new TypeToken<List<TestAccount>>() {}.getType();
		actlist = decode(actlistjson, new LinkedList<TestAccount>().getClass());
		actlistjson = encode(actlist);
		System.out.println(actlistjson);
    	
    	map.put("Account", account);
    	map.put("int", 1);
    	map.put("float", 2.0);
    	
    	try {
			String json = encode(map);
			System.out.println(json);
			Map<String, Object> tmpmap = JsonUtility.toDictionary(json);
			System.out.println(tmpmap);
			
			String actjson = encode(account);
			System.out.println(actjson);
			
			TestAccount actres = (TestAccount) decode(actjson, TestAccount.class);
			System.out.println(actres);
			
			Map<String, Object> res = decode(json, Map.class);
			Object maparyobj = res.get("MapAry");
			System.out.println(res);
			
			String aryjson = "[1,2,3,4,5,6]";
			
			Integer[] tmpres = (Integer[]) decode(aryjson, Integer[].class);
			System.out.println(ConvertUtility.getValueAsString(tmpres));
			
		} catch (Throwable e) {
			e.printStackTrace();
		}
    	
    	System.out.println("=========================");
    	long ms = System.currentTimeMillis();
    	for(int i=0; i<100; i++){
    		encode(account);
    	}
    	System.out.println("cost: " + (System.currentTimeMillis() - ms));
    	
    }

    
    private static class TestAccount {
        private int id;
        private String name;
        private String email;
        private String address;
        
        @Override
        public String toString() {
            return this.name + "#" + this.id + "#" + this.address + "#" + this.email;
        }

		/**
		 * @return the id
		 */
		public int getId() {
			return id;
		}

		/**
		 * @param id the id to set
		 */
		public void setId(int id) {
			this.id = id;
		}

		/**
		 * @return the name
		 */
		public String getName() {
			return name;
		}

		/**
		 * @param name the name to set
		 */
		public void setName(String name) {
			this.name = name;
		}

		/**
		 * @return the email
		 */
		public String getEmail() {
			return email;
		}

		/**
		 * @param email the email to set
		 */
		public void setEmail(String email) {
			this.email = email;
		}

		/**
		 * @return the address
		 */
		public String getAddress() {
			return address;
		}

		/**
		 * @param address the address to set
		 */
		public void setAddress(String address) {
			this.address = address;
		}
    	
    }
}
