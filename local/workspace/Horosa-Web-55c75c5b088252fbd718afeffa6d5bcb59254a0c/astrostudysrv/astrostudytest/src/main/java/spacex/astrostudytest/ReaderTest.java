package spacex.astrostudytest;

import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.types.cache.CacheFactory;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;
import spacex.astroreader.helper.ReaderHelper;

public class ReaderTest {

	private static void saveBook() {
		String file = "/Users/Shared/file/天择.txt";
		String[] parts = StringUtility.splitString(file, new char[] {'/', '\\'});
		String bookName = parts[parts.length-1];
		parts = StringUtility.splitString(bookName, '.');
		bookName = parts[0];
		String txt = FileUtility.getStringFromFile(file);
		ReaderHelper.saveBook("zjfchine@foxmail.com", bookName, "", txt);		
	}

	private static void updateChapter() {
		String userid = "zjfchine@foxmail.com";
		String bookid = "2afb5dcbb051415ebe4aae9351b5a613";
		int ord = 0;
		int lineno = 0;
		String txt = "前言";
		
		ReaderHelper.updateChapter(userid, bookid, ord, lineno, txt);
	}
	
	private static void getBooks(){
		String userid = "zjfchine@foxmail.com";
		List<Map<String, Object>> list = ReaderHelper.getUserBooks(userid);
		System.out.println(JsonUtility.encodePretty(list));
	}

	public static void main(String[] args) {
		CacheFactory.build("classpath:conf/properties/cache/caches.properties");
		
		saveBook();
//		updateChapter();
		getBooks();
		

	}
	
}
