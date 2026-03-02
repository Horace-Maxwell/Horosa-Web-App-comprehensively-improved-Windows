package spacex.astroreader.controller;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.interceptor.TransData;
import boundless.spring.help.interceptor.TransData.MultipartObject;
import boundless.types.FileType;
import boundless.utility.StringUtility;
import boundless.web.common.IUser;
import spacex.astroreader.helper.ReaderHelper;

@Controller
@RequestMapping("/astroreader")
public class ReaderController {

	@ResponseBody
	@RequestMapping("/upload")
	public void uploadBook(){
		MultipartObject[] multiobj = TransData.getMultiparts();
		if(multiobj == null || multiobj.length == 0){
			throw new ErrorCodeException(800, "no.found.file");
		}
		
		String bookName = TransData.getValueAsString("Name");
		String author = TransData.getValueAsString("Author");
		String encode = TransData.getValueAsString("Encode");
		if(StringUtility.isNullOrEmpty(encode)) {
			encode = "UTF-8";
		}
		
		MultipartObject obj = multiobj[0];
		byte[] raw = obj.getBytes();
		FileType ftype = FileType.fromBytes(raw);
		if(ftype != FileType.UNKNOWN) {
			throw new ErrorCodeException(700001, "filetype.error");
		}
		if(StringUtility.isNullOrEmpty(bookName)) {
			String fn = obj.getOriginalFilename();
			String[] parts = StringUtility.splitString(fn, new char[] {'/', '\\'});
			bookName = parts[parts.length-1];
			parts = StringUtility.splitString(bookName, '.');
			bookName = parts[0];			
		}
		try {
			String txt = new String(raw, encode);
			IUser user = TransData.getCurrentUser();
			ReaderHelper.saveBook(user, bookName, author, txt);			
			List<Map<String, Object>> books = ReaderHelper.getUserBooks(user);
			TransData.set("Books", books);
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw new ErrorCodeException(700010, e);
		}
	}
	
	@ResponseBody
	@RequestMapping("/listbooks")
	public void listBooks() {
		IUser user = TransData.getCurrentUser();
		String name = TransData.getValueAsString("Name");
		List<Map<String, Object>> books = ReaderHelper.getUserBooks(user, name);
		int total = books.size();
		if(TransData.hasPagination()) {
			books = TransData.getParties(books);			
		}
		TransData.set("Total", total);
		TransData.set("Books", books);
	}
	
	
	@ResponseBody
	@RequestMapping("/getchapter")
	public void getChapter() {
		IUser user = TransData.getCurrentUser();
		String bookId = TransData.getValueAsString("BookId");
		int ord = TransData.getValueAsInt("Ord", 0);
		if(StringUtility.isNullOrEmpty(bookId)) {
			throw new ErrorCodeException(700002, "miss.bookid");
		}
		Map<String, Object> chapter = ReaderHelper.getChapter(user, bookId, ord);
		TransData.set("Chapter", chapter);
	}
	
	@ResponseBody
	@RequestMapping("/updatebook")
	public void updateBook() {
		IUser user = TransData.getCurrentUser();
		String bookId = TransData.getValueAsString("BookId");
		if(StringUtility.isNullOrEmpty(bookId)) {
			throw new ErrorCodeException(700002, "miss.bookid");
		}
		
		String author = TransData.getValueAsString("Author");
		String name = TransData.getValueAsString("Name");
		String img = TransData.getValueAsString("Img");
		
		ReaderHelper.updateBook(user, bookId, author, name, img);
		List<Map<String, Object>> books = ReaderHelper.getUserBooks(user);
		TransData.set("Books", books);		
		
	}
	
	@ResponseBody
	@RequestMapping("/updatechapter")
	public void updateChapter() {
		IUser user = TransData.getCurrentUser();
		String bookId = TransData.getValueAsString("BookId");
		if(StringUtility.isNullOrEmpty(bookId)) {
			throw new ErrorCodeException(700002, "miss.bookid");
		}
		
		String text = TransData.getValueAsString("Text");
		int ord = TransData.getValueAsInt("Ord");
		int lineno = TransData.getValueAsInt("LineNo");
		
		ReaderHelper.updateChapter(user, bookId, ord, lineno, text);
		List<Map<String, Object>> books = ReaderHelper.getUserBooks(user);
		Map<String, Object> chapter = ReaderHelper.getChapter(user, bookId, ord);
		TransData.set("Books", books);	
		TransData.set("Chapter", chapter);
	}
	
	@ResponseBody
	@RequestMapping("/readprogress")
	public void readProgress() {
		IUser user = TransData.getCurrentUser();
		String bookId = TransData.getValueAsString("BookId");
		if(StringUtility.isNullOrEmpty(bookId)) {
			throw new ErrorCodeException(700002, "miss.bookid");
		}
		if(!TransData.containsParam("Ord")) {
			throw new ErrorCodeException(700003, "miss.progress.ord");			
		}
		int ord = TransData.getValueAsInt("Ord");

		ReaderHelper.updateReadProgress(user, bookId, ord);
		List<Map<String, Object>> books = ReaderHelper.getUserBooks(user);
		TransData.set("Books", books);		
	}
	
	@ResponseBody
	@RequestMapping("/deletebook")
	public void deletebook() {
		IUser user = TransData.getCurrentUser();
		String bookId = TransData.getValueAsString("BookId");
		if(StringUtility.isNullOrEmpty(bookId)) {
			throw new ErrorCodeException(700002, "miss.bookid");
		}

		ReaderHelper.deleteBook(user, bookId);
		List<Map<String, Object>> books = ReaderHelper.getUserBooks(user);
		TransData.set("Books", books);
		
	}
	
	
	@ResponseBody
	@RequestMapping("/allbooks")
	public void allBooks() {
		String name = TransData.getValueAsString("Name");
		String uid = TransData.getValueAsString("User");
		List<Map<String, Object>> books = ReaderHelper.getBooks(name, uid);
		int total = books.size();
		if(TransData.hasPagination()) {
			books = TransData.getParties(books);			
		}
		TransData.set("Total", total);
		TransData.set("Books", books);
	}
	
	@ResponseBody
	@RequestMapping("/removebook")
	public void forcedeletebook() {
		String bookId = TransData.getValueAsString("BookId");
		if(StringUtility.isNullOrEmpty(bookId)) {
			throw new ErrorCodeException(700002, "miss.bookid");
		}

		ReaderHelper.deleteBook(bookId);		
	}
		
	@ResponseBody
	@RequestMapping("/editchapter")
	public void editChapter() {
		String bookId = TransData.getValueAsString("BookId");
		if(StringUtility.isNullOrEmpty(bookId)) {
			throw new ErrorCodeException(700002, "miss.bookid");
		}
		String userid = TransData.getValueAsString("UserId");
		if(StringUtility.isNullOrEmpty(userid)) {
			throw new ErrorCodeException(700004, "miss.userid");
		}
		
		String text = TransData.getValueAsString("Text");
		int ord = TransData.getValueAsInt("Ord");
		int lineno = TransData.getValueAsInt("LineNo");
		
		ReaderHelper.updateChapter(userid, bookId, ord, lineno, text);
		List<Map<String, Object>> books = ReaderHelper.getUserBooks(userid);
		Map<String, Object> chapter = ReaderHelper.getChapter(userid, bookId, ord);
		TransData.set("Books", books);	
		TransData.set("Chapter", chapter);
	}
	
	@ResponseBody
	@RequestMapping("/exportbook")
	public void exportbook() {
		IUser user = TransData.getCurrentUser();
		String bookId = TransData.getValueAsString("BookId");

		Map<String, String> book = ReaderHelper.export(user.getLoginId(), bookId);
		if(book == null) {
			throw new ErrorCodeException(700005, "no.found.book");
		}
		
		String filename = book.get("name");
		String content = book.get("content");
		try {
			byte[] data = content.getBytes("UTF-8");
			TransData.setRawData(data, FileType.TXTBIN, filename);			
		}catch(Exception e) {
			throw new ErrorCodeException(700006, e);
		}
	}
	

}
