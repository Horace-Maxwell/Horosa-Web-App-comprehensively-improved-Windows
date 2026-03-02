package spacex.astroreader.helper;

import java.io.BufferedReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.types.OutParameter;
import boundless.types.Tuple4;
import boundless.types.cache.CacheFactory;
import boundless.types.cache.FilterCond;
import boundless.types.cache.FilterCond.CondOperator;
import boundless.types.cache.SortCond.SortType;
import boundless.types.cache.SortCond;
import boundless.utility.ConvertUtility;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;

public class ReaderHelper {
	
	static private ICache cacheBooks = CacheFactory.getCache("books");
	static private ICache cacheShelf = CacheFactory.getCache("userbooks");
	
	private static boolean isNewChapter(String bookName, String line) {
		String pattern = "^\\s{0,2}(([\\S]{0,8})|正文\\s{0,2})第(([0123456789〇零一二三四五六七八九十两百千万]{1,10})([章节卷集部篇回讲季\\.]{1,1})(.{0,32})|([0123456789〇零一二三四五六七八九十两百千万]{1,10})(\\s{0,4})(.{0,32}))(\\s*)$";
		Pattern p = Pattern.compile(pattern);
		Matcher matcher = p.matcher(line);
		boolean flag = matcher.find();
		if(!flag && !StringUtility.isNullOrEmpty(bookName)) {
			int len = bookName.length() + 8;
			if(line.trim().startsWith(bookName) && line.length() < len) {
				return true;
			}
		}
		if(!flag) {
			pattern = "^([0123456789〇零一二三四五六七八九十两百千万]{1,10})([章节卷集部篇回讲季\\.]{0,1})(、|([\\s]{1,2}))(.{0,32})(\\s*)";
			p = Pattern.compile(pattern);
			matcher = p.matcher(line);
			flag = matcher.find();
		}
		return flag;
	}

	public static List<Tuple4<String, List<String>, Integer, Integer>> splitChapter(String bookName, String txt, OutParameter<Integer> wordsparam, OutParameter<Integer> chaptersparam) {
		BufferedReader reader = new BufferedReader(new StringReader(txt));
		List<Tuple4<String, List<String>, Integer, Integer>> list = new LinkedList<Tuple4<String, List<String>, Integer, Integer>>();
		int total = 0;
		int chapters = 0;
		try {
			String line = reader.readLine();
			Tuple4<String, List<String>, Integer, Integer> tuple = new Tuple4<String, List<String>, Integer, Integer>(null, new ArrayList<String>(), 0, 0);
			while(line != null) {
				if(isNewChapter(bookName, line)) {
					if(tuple.item1() != null) {
						list.add(tuple);	
						chapters++;
					}
					List<String> sb = new ArrayList<String>();
					sb.add(line);
					tuple = new Tuple4<String, List<String>, Integer, Integer>(line, sb, 0, 0);
				}else {
					tuple.item2().add(line);
					if(tuple.item1() == null) {
						if(!StringUtility.isNullOrEmpty(line)) {
							tuple.item1(line);
						}
					}
				}
				int cnt = tuple.item3() + 1;
				tuple.item3(cnt);
				int linewords = line.length();
				int words = tuple.item4() + linewords;
				tuple.item4(words);
				total += linewords;

				line = reader.readLine();
			}
			
			list.add(tuple);
			chapters++;
			
			if(wordsparam != null) {
				wordsparam.value = total;
			}
			if(chaptersparam != null) {
				chaptersparam.value = chapters;
			}
			return list;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}finally {
			try {
				reader.close();				
			}catch(Exception e) {
			}
		}
	}
	
	private static void saveChapter(Tuple4<String, List<String>, Integer, Integer> tuple, int ord, String bookid, int pos, double percent){
		Map<String, Object> map = new HashMap<String, Object>();
		String id = getChapterId(bookid, ord);
		map.put("chapterId", id);
		map.put("title", tuple.item1());
		map.put("content", tuple.item2());
		map.put("lines", tuple.item3());
		map.put("words", tuple.item4());
		map.put("ord", ord);
		map.put("bookId", bookid);
		map.put("pos", pos);
		map.put("percent", percent);
		try {
			cacheBooks.setMap(id, map);			
		}catch(Exception e) {
			map.remove("content");
			QueueLog.error(AppLoggers.ErrorLogger, "txt file error.");
			QueueLog.error(AppLoggers.ErrorLogger, JsonUtility.encodePretty(map));
			throw new RuntimeException(e);
		}
	}
	
	private static Map<String, Object> genBook(String bookname, int words, int chapters, String author) {
		Map<String, Object> map = new HashMap<String, Object>();
		String bookid = StringUtility.getUUID();
		map.put("bookId", bookid);
		map.put("name", bookname);
		map.put("author", author);
		map.put("words", words);
		map.put("chapters", chapters);
		map.put("img", "");
		return map;
	}
	
	private static String getUserBookId(String userId, String bookid) {
		String id = String.format("%s_||_%s", userId, bookid);
		return id;
	}
	
	private static String getChapterId(String bookId, int ord) {
		String id = String.format("%s_%d", bookId, ord);
		return id;
	}
	
	private static void saveBookShelf(String userid, String bookid, List<Map<String, Object>> catalog, String name, int words, String author) {
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("bookId", bookid);
		map.put("user", userid);
		map.put("name", name);
		map.put("author", author);
		map.put("img", "");
		map.put("currentOrd", 0);
		map.put("catalog", catalog);
		map.put("chapters", catalog.size());
		map.put("words", words);
		map.put("time", System.currentTimeMillis());
		
		String id = getUserBookId(userid, bookid);
		map.put("shelfId", id);
		cacheShelf.setMap(id, map);
	}
	
	public static void saveBook(IUser user, String bookName, String author, String txt) {
		saveBook(user.getLoginId(), bookName, author, txt);
	}
	
	public static void saveBook(String userid, String bookName, String author, String txt) {
		OutParameter<Integer> total = new OutParameter<Integer>();
		OutParameter<Integer> chapters = new OutParameter<Integer>();
		List<Tuple4<String, List<String>, Integer, Integer>> list = splitChapter(bookName, txt, total, chapters);
		int words = total.value;
		int totalchapters = chapters.value;
		Map<String, Object> book = genBook(bookName, words, totalchapters, author);
		String bookid = (String) book.get("bookId");
		int ord = 0;
		int pos = 0;
		List<Map<String, Object>> catalog = new ArrayList<Map<String, Object>>(list.size());
		for(Tuple4<String, List<String>, Integer, Integer> tuple : list) {
			double percent = pos*100.0 / words;
			percent = Math.floor(percent) + (Math.round(percent*1000) % 1000) * 0.001;
			saveChapter(tuple, ord, bookid, pos, percent);
			
			Map<String, Object> sumap = new HashMap<String, Object>();
			sumap.put("title", tuple.item1());
			sumap.put("ord", ord);
			sumap.put("words", tuple.item4());
			catalog.add(sumap);
			
			ord++;
			pos += tuple.item4();
		}
		
		book.put("catalog", catalog);
		cacheBooks.setMap(bookid, book);
		
		saveBookShelf(userid, bookid, catalog, bookName, words, author);
	}
	
	public static Map<String, Object> getUserBook(IUser user, String bookId){
		return getUserBook(user.getLoginId(), bookId);
	}
	
	public static Map<String, Object> getUserBook(String userid, String bookId){
		String shelfid = getUserBookId(userid, bookId);
		Map<String, Object> shelf = cacheShelf.getMap(shelfid);
		return shelf;
	}
	
	public static Map<String, Object> getChapter(IUser user, String bookId, int ord){
		Map<String, Object> chapter = getChapter(user.getLoginId(), bookId, ord);
		if(chapter == null && user.isAdmin()) {
			String id = getChapterId(bookId, ord);
			Map<String, Object> map = cacheBooks.getMap(id);
			return map;				
		}
		return chapter;
	}
	
	public static Map<String, Object> getChapter(String userid, String bookId, int ord){
		Map<String, Object> shelf = getUserBook(userid, bookId);
		if(shelf == null) {
			return null;
		}
		
		String id = getChapterId(bookId, ord);
		Map<String, Object> map = cacheBooks.getMap(id);
		
		return map;
	}
	
	public static List<Map<String, Object>> getUserBooks(String userid){
		return getUserBooks(userid, null);
	}
	
	public static List<Map<String, Object>> getUserBooks(IUser user){
		return getUserBooks(user.getLoginId(), null);
	}
	
	public static List<Map<String, Object>> getUserBooks(IUser user, String name){
		return getUserBooks(user.getLoginId(), name);
	}
	
	public static List<Map<String, Object>> getUserBooks(String userid, String name){
		FilterCond cond = new FilterCond("user", CondOperator.Eq, userid);
		FilterCond[] conds = new FilterCond[] {cond};
		if(!StringUtility.isNullOrEmpty(name)) {
			FilterCond namecond = new FilterCond("name", CondOperator.Like, name);	
			conds = new FilterCond[] {cond, namecond};
		}
		SortCond sort = new SortCond("time", SortType.Desc);
		
		List<Map<String, Object>> res = cacheShelf.findValues(sort, conds);
		return res;
	}
	
	public static List<Map<String, Object>> getBooks(String name, String userid){
		FilterCond[] conds = new FilterCond[] {};
		if(!StringUtility.isNullOrEmpty(name)) {
			FilterCond namecond = new FilterCond("name", CondOperator.Like, name);	
			conds = new FilterCond[] {namecond};
		}
		if(!StringUtility.isNullOrEmpty(userid)) {
			FilterCond usercond = new FilterCond("user", CondOperator.Eq, userid);	
			if(conds.length == 0) {
				conds = new FilterCond[] {usercond};				
			}else {
				conds = new FilterCond[] {conds[0], usercond};	
			}
		}
		SortCond sort = new SortCond("name", SortType.Asc);
		
		List<Map<String, Object>> res = cacheShelf.findValues(sort, conds);
		return res;
	}
	
	public static void updateBook(IUser user, String bookId, String author, String name, String img) {
		updateBook(user.getLoginId(), bookId, author, name, img);
	}
	
	public static void updateBook(String userid, String bookId, String author, String name, String img) {
		Map<String, Object> shelf = getUserBook(userid, bookId);
		if(shelf == null) {
			return;
		}
		
		if(!StringUtility.isEmail(author)) {
			shelf.put("author", author);			
		}
		if(!StringUtility.isEmail(name)) {
			shelf.put("name", name);
		}
		if(!StringUtility.isEmail(img)) {
			shelf.put("img", img);
		}
		shelf.put("time", System.currentTimeMillis());
		String shelfid = (String) shelf.get("shelfId");
		cacheShelf.setMap(shelfid, shelf);
		
		String bookid = (String) shelf.get("bookId");
		Map<String, Object> book = cacheBooks.getMap(bookid);
		if(!StringUtility.isEmail(author)) {
			book.put("author", author);			
		}
		if(!StringUtility.isEmail(name)) {
			book.put("name", name);
		}
		if(!StringUtility.isEmail(img)) {
			book.put("img", img);
		}
		cacheBooks.setMap(bookid, book);
	}
	
	public static void updateReadProgress(IUser user, String bookId, int ord) {
		Map<String, Object> shelf = getUserBook(user, bookId);
		if(shelf == null) {
			return;
		}
		
		int curr = ord;
		if(ord < 0) {
			curr = 0;
		}
		shelf.put("currentOrd", curr);
		shelf.put("time", System.currentTimeMillis());
		
		String key = getUserBookId(user.getLoginId(), bookId);
		cacheShelf.setMap(key, shelf);
	}
	
	public static void deleteBook(IUser user, String bookid) {
		deleteBook(user.getLoginId(), bookid);
	}
	
	public static void deleteBook(String userid, String bookid) {
		String id = getUserBookId(userid, bookid);
		Map<String, Object> map = cacheShelf.getMap(id);
		if(map == null) {
			return;
		}
		
		String bookId = (String) map.get("bookId");
		FilterCond bookcond = new FilterCond("bookId", CondOperator.Eq, bookId);
		cacheBooks.remove(bookcond);
		
		cacheShelf.remove(id);
	}
	
	public static void deleteBook(String bookid) {
		FilterCond bookcond = new FilterCond("bookId", CondOperator.Eq, bookid);
		cacheBooks.remove(bookcond);
		cacheShelf.remove(bookcond);
	}
	
	public static void updateChapter(IUser user, String bookid, int ord, int lineno, String txt) {
		updateChapter(user.getLoginId(), bookid, ord, lineno, txt);
	}
	
	public static void updateChapter(String userid, String bookid, int ord, int lineno, String txt) {
		Map<String, Object> chapter = getChapter(userid, bookid, ord);
		if(chapter == null) {
			return;
		}
		
		String content = (String) chapter.get("content");
		List<String> list = JsonUtility.decodeList(content, String.class);
		if(lineno >= list.size()) {
			return;
		}
		
		String orgtxt = list.get(lineno);
		int orglinesz = orgtxt.length();
		int linesz = 0;
		if(!StringUtility.isNullOrEmpty(txt)) {
			linesz = txt.length();
		}
		int delta = linesz - orglinesz;
		
		Map<String, Object> book = cacheBooks.getMap(bookid);
		Map<String, Object> shelf = getUserBook(userid, bookid);
		
		if(lineno == 0) {
			chapter.put("title", txt);
			String catalog = (String) shelf.get("catalog");
			List<Map> catalist = JsonUtility.decodeList(catalog, Map.class);
			Map<String, Object> catamap = (Map<String, Object>) catalist.get(0);
			catamap.put("title", txt);
			int wd = ConvertUtility.getValueAsInt(catamap.get("words"));
			wd += delta;
			catamap.put("words", wd);
			catalist.set(ord, catamap);
			shelf.put("catalog", catalist);
			book.put("catalog", catalist);
		}
		long words = ConvertUtility.getValueAsLong(shelf.get("words"));
		words += delta;
		shelf.put("words", words);

		book.put("words", words);
		cacheBooks.setMap(bookid, book);
		
		String shelfid = (String) shelf.get("shelfId");
		cacheShelf.setMap(shelfid, shelf);

		list.set(lineno, txt);
		String chapterid = (String) chapter.get("chapterId");
		long chapwords = ConvertUtility.getValueAsLong(chapter.get("words"));
		chapwords += delta;
		chapter.put("words", chapwords);
		chapter.put("content", list);
		cacheBooks.setMap(chapterid, chapter);		
	}
	
	public static Map<String, String> export(String userid, String bookId) {
		Map<String, Object> shelf = getUserBook(userid, bookId);
		if(shelf == null) {
			return null;
		}
		
		String name = (String) shelf.get("name");
		int chapters = ConvertUtility.getValueAsInt(shelf.get("chapters"));
		StringBuilder sb = new StringBuilder();
		for(int i=0; i<chapters; i++) {
			String id = getChapterId(bookId, i);
			Map<String, Object> map = cacheBooks.getMap(id);
			if(map != null && !map.isEmpty()) {
				String txt = (String) map.get("content");
				List<String> content = JsonUtility.decodeList(txt, String.class);
				for(String str : content) {
					sb.append(str).append("\r\n");
				}
				sb.append("\r\n");
			}
		}
		Map<String, String> res = new HashMap<String, String>();
		res.put("name", name);
		res.put("content", sb.toString());
		return res;
	}
	
	public static void main(String[] args) {
		String dest = "/Users/zjf/file/bbb/";
		String file = "/Users/zjf/file/穹顶之上.txt";
		String bookName = "穹顶之上";
		String txt = FileUtility.getStringFromFile(file);
		OutParameter<Integer> total = new OutParameter<Integer>();
		OutParameter<Integer> chapters = new OutParameter<Integer>();
		List<Tuple4<String, List<String>, Integer, Integer>> list = splitChapter(bookName, txt, total, chapters);
		for(Tuple4<String, List<String>, Integer, Integer> tuple : list) {
			String filename = String.format("%s%s.txt", dest, tuple.item1());
			System.out.println(filename);
//			FileUtility.save(filename, StringUtility.joinWithSeperator("\r\n", tuple.item2()));
		}
		
		System.out.println(String.format("共：%d章，%d 字", chapters.value, total.value));
	}
	
}
