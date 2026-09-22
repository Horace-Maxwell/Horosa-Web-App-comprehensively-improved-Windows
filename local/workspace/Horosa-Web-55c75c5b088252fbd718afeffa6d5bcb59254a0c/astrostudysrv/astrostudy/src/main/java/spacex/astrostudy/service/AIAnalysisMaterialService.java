package spacex.astrostudy.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

import boundless.exception.ErrorCodeException;
import boundless.io.FileUtility;
import boundless.utility.StringUtility;

@Service
public class AIAnalysisMaterialService {
	// [D58] 抽取上限(单源):解码后 ≤30 MB;PDF 只抽前 500 页;正文 ≤2,000,000 字;POI 解压比阈值显式配置(zip 炸弹)
	static final int MAX_DECODED_BYTES = 30 * 1024 * 1024;
	static final int MAX_BASE64_CHARS = (int) ((long) MAX_DECODED_BYTES * 4 / 3 + 4096);
	static final int MAX_PDF_PAGES = 500;
	static final int MAX_TEXT_CHARS = 2000000;
	static {
		try {
			org.apache.poi.openxml4j.util.ZipSecureFile.setMinInflateRatio(0.001d);
			org.apache.poi.openxml4j.util.ZipSecureFile.setMaxFileCount(2000);
		} catch(Throwable ignore) { /* 旧版 POI 无此 API 时保持缺省 */ }
	}

	public Map<String, Object> extract(Map<String, Object> params){
		String fileName = stringVal(params, "fileName");
		String mimeType = stringVal(params, "mimeType");
		String base64Data = stringVal(params, "base64Data");
		if(StringUtility.isNullOrEmpty(base64Data)) {
			throw new ErrorCodeException(580101, "缺少 base64Data");
		}
		// [D58] 体积上限先于解码(此前无界:Base64.decode 无界、PDF 页数无界、zip 炸弹阈值未配、无超时;前端 50 MB 只是可跳过的软提示)
		if(base64Data.length() > MAX_BASE64_CHARS) {
			throw new ErrorCodeException(580103, "资料过大:超过 " + (MAX_DECODED_BYTES / (1024 * 1024)) + " MB 上限");
		}
		byte[] bytes = Base64.getDecoder().decode(base64Data);
		if(bytes.length > MAX_DECODED_BYTES) {
			throw new ErrorCodeException(580103, "资料过大:超过 " + (MAX_DECODED_BYTES / (1024 * 1024)) + " MB 上限");
		}
		String ext = lowerExt(fileName);
		if(StringUtility.isNullOrEmpty(mimeType)) {
			try{
				mimeType = FileUtility.getContentType(bytes);
			}catch(Exception e){
				mimeType = "";
			}
		}
		Map<String, Object> result = new LinkedHashMap<String, Object>();
		result.put("fileName", fileName);
		result.put("fileExt", ext);
		result.put("mimeType", mimeType);
		result.put("size", bytes.length);
		result.put("fileHash", sha256(bytes));
		String extractedText;
		Map<String, Object> extractMeta = new LinkedHashMap<String, Object>();
		try{
			if(".pdf".equals(ext) || mimeType.contains("pdf")) {
				PdfExtract pdfExtract = extractPdf(bytes);
				extractedText = pdfExtract.text;
				extractMeta.put("pageCount", pdfExtract.pageCount);
				// [Q-060/AW-23] 页数封顶此前只把**总页数**报回去、不报「被截了」——前端无从判断
				// 「pageCount=1200」是全抽了 1200 页还是只抽了前 500 页,界面于是什么都不提示。
				if(pdfExtract.pageCount > MAX_PDF_PAGES) {
					extractMeta.put("pagesTruncated", Boolean.TRUE);
					extractMeta.put("pageCap", MAX_PDF_PAGES);
				}
				extractMeta.put("extractor", "pdfbox");
			}else if(".docx".equals(ext)) {
				DocExtract docxExtract = extractDocx(bytes);
				extractedText = docxExtract.text;
				extractMeta.put("paragraphCount", docxExtract.paragraphCount);
				extractMeta.put("extractor", "poi-xwpf");
			}else if(".doc".equals(ext)) {
				DocExtract docExtract = extractDoc(bytes);
				extractedText = docExtract.text;
				extractMeta.put("paragraphCount", docExtract.paragraphCount);
				extractMeta.put("extractor", "poi-hwpf");
			}else {
				extractedText = new String(bytes, StandardCharsets.UTF_8);
				extractMeta.put("extractor", "plain-text");
			}
		}catch(Exception e){
			throw new ErrorCodeException(580102, "资料抽取失败：" + e.getMessage());
		}
		extractedText = extractedText == null ? "" : extractedText.trim();
		if(extractedText.length() > MAX_TEXT_CHARS) {
			extractedText = extractedText.substring(0, MAX_TEXT_CHARS);
			extractMeta.put("truncated", Boolean.TRUE);
			extractMeta.put("textCap", MAX_TEXT_CHARS);
		}
		result.put("extractedText", extractedText);
		result.put("textHash", sha256(extractedText.getBytes(StandardCharsets.UTF_8)));
		result.put("extractMeta", extractMeta);
		return result;
	}

	private PdfExtract extractPdf(byte[] bytes) throws IOException{
		try(PDDocument document = PDDocument.load(bytes)) {
			PDFTextStripper stripper = new PDFTextStripper();
			PdfExtract result = new PdfExtract();
			result.pageCount = document.getNumberOfPages();
			// [D58] 页数封顶:超过 MAX_PDF_PAGES 只抽前 N 页(千页 PDF 不再把线程拖死),页数原样报给前端
			if(result.pageCount > MAX_PDF_PAGES) {
				stripper.setStartPage(1);
				stripper.setEndPage(MAX_PDF_PAGES);
			}
			result.text = stripper.getText(document);
			return result;
		}
	}

	private DocExtract extractDocx(byte[] bytes) throws IOException{
		try(
			ByteArrayInputStream input = new ByteArrayInputStream(bytes);
			XWPFDocument document = new XWPFDocument(input);
			XWPFWordExtractor extractor = new XWPFWordExtractor(document)
		){
			DocExtract result = new DocExtract();
			result.text = extractor.getText();
			result.paragraphCount = document.getParagraphs().size();
			return result;
		}
	}

	private DocExtract extractDoc(byte[] bytes) throws IOException{
		try(
			ByteArrayInputStream input = new ByteArrayInputStream(bytes);
			HWPFDocument document = new HWPFDocument(input);
			WordExtractor extractor = new WordExtractor(document)
		){
			DocExtract result = new DocExtract();
			result.text = extractor.getText();
			result.paragraphCount = document.getRange() == null ? 0 : document.getRange().numParagraphs();
			return result;
		}
	}

	private String lowerExt(String fileName){
		String text = fileName == null ? "" : fileName.trim();
		int idx = text.lastIndexOf('.');
		if(idx < 0){
			return "";
		}
		return text.substring(idx).toLowerCase();
	}

	private String sha256(byte[] bytes){
		try{
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] hash = digest.digest(bytes);
			StringBuilder sb = new StringBuilder();
			for(byte item : hash) {
				sb.append(String.format("%02x", item));
			}
			return sb.toString();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	private String stringVal(Map<String, Object> map, String key){
		Object val = map == null ? null : map.get(key);
		return val == null ? "" : String.valueOf(val).trim();
	}

	private static class PdfExtract {
		String text;
		int pageCount;
	}

	private static class DocExtract {
		String text;
		int paragraphCount;
	}
}
