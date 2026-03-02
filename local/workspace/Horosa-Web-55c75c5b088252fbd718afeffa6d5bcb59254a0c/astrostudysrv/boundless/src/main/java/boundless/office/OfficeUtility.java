package boundless.office;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.poi.hssf.usermodel.HSSFCell;
import org.apache.poi.hssf.usermodel.HSSFRow;
import org.apache.poi.hssf.usermodel.HSSFSheet;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import boundless.io.CompressUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.OutParameter;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class OfficeUtility {
	
	private static List<Object[]> readSheet(Sheet sheet, int firstRow, int lastRow, int firstCol, int lastCol){
		List<Object[]> list = new ArrayList<Object[]>();
        for (int i = firstRow; i <= lastRow; i++) {
        	Row row = sheet.getRow(i);
        	if(row == null){
        		continue;
        	}
            List innerList=new ArrayList(lastCol - firstCol + 1);
            for (int j = firstCol; j < lastCol; j++) {
            	Cell cell = row.getCell(j);
            	Object value = null;
            	if(cell != null){
            		CellType type = cell.getCellTypeEnum();
            		if(type == CellType.FORMULA) {
            			value = cell.getNumericCellValue();
            		}else {
                		value = cell.toString();            			
            		}
            	}
            	innerList.add(value);
            }
            Object[] objs = new Object[innerList.size()];
            innerList.toArray(objs);
            list.add(objs);
        }
		return list;
	}

	public static Map<String, List<Object[]>> readExcel(InputStream ins, int firstCol, int lastCol) {
		Map<String, List<Object[]>> map = new HashMap<String, List<Object[]>>();
		Workbook wb = null;
		try {
			wb = WorkbookFactory.create(ins);
            // Excel的页签数量
            int sheet_size = wb.getNumberOfSheets();
            for (int index = 0; index < sheet_size; index++) {
            	Sheet sheet = wb.getSheetAt(index);
                int firstrow = sheet.getFirstRowNum();
                int lastrow = sheet.getLastRowNum();
            	List<Object[]> data = readSheet(sheet, firstrow, lastrow, firstCol, lastCol);
            	String sname = sheet.getSheetName();
                map.put(sname, data);
            }
    		return map;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}finally{
			if(wb != null){
				try {
					wb.close();
				} catch (Exception e) { }
			}
		}
	}
	
	public static boolean isXlsx(byte[] raw){
		try{
			ByteArrayInputStream bis = new ByteArrayInputStream(raw);			
			boolean flag = isXlsx(bis);		
			bis.close();
			return flag;
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return false;
		}
	}
	
	public static boolean isXlsx(InputStream ins){
		try{
			OutParameter<Boolean> res = new OutParameter<Boolean>();
			res.value = false;
			OutParameter<Boolean> hascont = new OutParameter<Boolean>();
			hascont.value = false;
			CompressUtility.probe(ins, (name, content)->{
				if(name.equals("[Content_Types].xml") || name.startsWith("docProps/")){
					hascont.value = true;
				}
				if(hascont.value && name.startsWith("xl/")){
					res.value = true;
					return true;
				}
				return false;
			});
			
			return res.value;			
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return false;
		}
	}
	
	public static boolean isDocx(InputStream ins){
		try{
			OutParameter<Boolean> res = new OutParameter<Boolean>();
			res.value = false;
			OutParameter<Boolean> hascont = new OutParameter<Boolean>();
			hascont.value = false;
			CompressUtility.probe(ins, (name, content)->{
				if(name.equals("[Content_Types].xml") || name.startsWith("docProps/")){
					hascont.value = true;
				}
				if(hascont.value && name.startsWith("word/")){
					res.value = true;
					return true;
				}
				return false;
			});
			
			return res.value;			
		}catch(Exception e){
			QueueLog.error(AppLoggers.ErrorLogger, e);
			return false;
		}
	}
	
	public static byte[] writeXls(List<Map<String, Object>> list, String[] keys) {
		return writeXls(list, keys, null);
	}
	
	public static byte[] writeXls(List<Map<String, Object>> list, String[] keys, String sheetName) {
		try {
			HSSFWorkbook workbook = new HSSFWorkbook();
			String sheetN = sheetName;
			if(StringUtility.isNullOrEmpty(sheetN)) {
				sheetN = "Sheet1";
			}
			HSSFSheet sheet = workbook.createSheet(sheetN);
			int rowidx = 0;
			for(Map<String, Object> map : list) {
				HSSFRow row = sheet.createRow(rowidx);
				for(int i=0; i<keys.length; i++) {
					HSSFCell cell = row.createCell(i);
					Object val = map.get(keys[i]);
					cell.setCellValue(ConvertUtility.getValueAsString(val));
				}
				rowidx++;
			}
			ByteArrayOutputStream ops = new ByteArrayOutputStream();
			workbook.write(ops);
			byte[] raw = ops.toByteArray();
			workbook.close();
			return raw;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] writeXlsx(List<Map<String, Object>> list, String[] keys) {
		return writeXlsx(list, keys, null);
	}
		
	public static byte[] writeXlsx(List<Map<String, Object>> list, String[] keys, String sheetName) {
		try {
			XSSFWorkbook workbook = new XSSFWorkbook();
			String sheetN = sheetName;
			if(StringUtility.isNullOrEmpty(sheetN)) {
				sheetN = "Sheet1";
			}
			XSSFSheet sheet = workbook.createSheet(sheetN);
			int rowidx = 0;
			for(Map<String, Object> map : list) {
				XSSFRow row = sheet.createRow(rowidx);
				for(int i=0; i<keys.length; i++) {
					XSSFCell cell = row.createCell(i);
					Object val = map.get(keys[i]);
					cell.setCellValue(ConvertUtility.getValueAsString(val));
				}
				rowidx++;
			}
			ByteArrayOutputStream ops = new ByteArrayOutputStream();
			workbook.write(ops);
			byte[] raw = ops.toByteArray();
			workbook.close();
			return raw;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] writeXlsx(Map<String, List<Map<String, Object>>> sheetmap, Map<String, String[]> keysmap) {
		try {
			XSSFWorkbook workbook = new XSSFWorkbook();
			for(Map.Entry<String, List<Map<String, Object>>> entry : sheetmap.entrySet()) {
				String sheetname = entry.getKey();
				List<Map<String, Object>> list = entry.getValue();
				
				String[] keys = keysmap.get(sheetname);
				XSSFSheet sheet = workbook.createSheet(sheetname);
				int rowidx = 0;
				for(Map<String, Object> map : list) {
					XSSFRow row = sheet.createRow(rowidx);
					for(int i=0; i<keys.length; i++) {
						XSSFCell cell = row.createCell(i);
						Object val = map.get(keys[i]);
						cell.setCellValue(ConvertUtility.getValueAsString(val));
					}
					rowidx++;
				}				
			}

			ByteArrayOutputStream ops = new ByteArrayOutputStream();
			workbook.write(ops);
			byte[] raw = ops.toByteArray();
			workbook.close();
			return raw;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static byte[] writeXlsx(Map<String, List<Map<String, Object>>> sheetmap, Map<String, String[]> keysmap, String[] sheetnames) {
		try {
			XSSFWorkbook workbook = new XSSFWorkbook();
			for(String sheetname : sheetnames) {
				List<Map<String, Object>> list = sheetmap.get(sheetname);
				
				String[] keys = keysmap.get(sheetname);
				XSSFSheet sheet = workbook.createSheet(sheetname);
				int rowidx = 0;
				for(Map<String, Object> map : list) {
					XSSFRow row = sheet.createRow(rowidx);
					for(int i=0; i<keys.length; i++) {
						XSSFCell cell = row.createCell(i);
						Object val = map.get(keys[i]);
						cell.setCellValue(ConvertUtility.getValueAsString(val));
					}
					rowidx++;
				}								
			}
			
			ByteArrayOutputStream ops = new ByteArrayOutputStream();
			workbook.write(ops);
			byte[] raw = ops.toByteArray();
			workbook.close();
			return raw;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}

}
