package boundless.types;

import boundless.utility.StringUtility;

public enum FileType {
	UNKNOWN,
	BIN,
	TXT,
	TXTBIN,
	DIR,
	JPEG,
	PNG,
	GIF,
	TIFF,
	BMP,
	ZIP,
	RAR,
	WAV,
	AVI,
	MPEG,
	XLS,
	XLSX,
	MP3,
	MP4;
	
	public String getContentType() {
		return getContentType(this);
	}
	
	public String getFileExt() {
		if(this == JPEG) {
			return ".jpg";
		}
		if(this == PNG) {
			return ".png";
		}
		if(this == GIF) {
			return ".gif";
		}
		if(this == TIFF) {
			return ".tiff";
		}
		if(this == BMP) {
			return ".bmp";
		}
		if(this == ZIP) {
			return ".zip";
		}
		if(this == RAR) {
			return ".rar";
		}
		if(this == WAV) {
			return ".wav";
		}
		if(this == AVI) {
			return ".avi";
		}
		if(this == MPEG) {
			return ".mpeg";
		}
		if(this == XLS) {
			return ".xls";
		}
		if(this == XLSX) {
			return ".xlsx";
		}
		if(this == MP3) {
			return ".mp3";
		}
		if(this == MP4) {
			return ".mp4";
		}
		if(this == TXT || this == TXTBIN) {
			return ".txt";
		}
		
		return "";
	}
	
	public static FileType fromBytes(byte[] raw){
		String hex = StringUtility.toHex(raw, 16).replace(" ", "").toUpperCase();
		if(hex.contains("FFD8FF")){
			return FileType.JPEG;
		}else if(hex.contains("89504E47")){
			return FileType.PNG;
		}else if(hex.contains("47494638")){
			return FileType.GIF;
		}else if(hex.contains("49492A00")){
			return FileType.TIFF;
		}else if(hex.contains("424D")){
			return FileType.BMP;
		}else if(hex.contains("504B0304")){
			return FileType.ZIP;
		}else if(hex.contains("52617221")){
			return FileType.RAR;
		}else if(hex.contains("57415645")){
			return FileType.WAV;
		}else if(hex.contains("41564920")){
			return FileType.AVI;
		}else if(hex.contains("000001BA")){
			return FileType.MPEG;
		}else if(hex.contains("000001B3")){
			return FileType.MPEG;
		}else if(hex.contains("D0CF11E0")){
			return FileType.XLS;
		}else if(hex.contains("49443303000000002176")){
			return FileType.MP3;
		}else if(hex.contains("464C5601050000000900")){
			return FileType.MP4;
		}else{
			return FileType.UNKNOWN;
		}
	}
	
	public static String getContentType(FileType ft){
		switch(ft){
		case JPEG: return "image/jpeg";
		case PNG: return "image/png";
		case GIF: return "image/gif";
		case TIFF: return "image/tiff";
		case BMP: return "image/bmp";
		case AVI: return "video/avi";
		case MPEG: return "video/mpeg";
		case ZIP: return "application/zip";
		case RAR: return "application/octet-stream";
		case XLS: return "application/vnd.ms-excel";
		case XLSX: return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
		case MP3: return "audio/mpeg";
		case MP4: return "video/mpeg4";
		case TXT: return "text/plain";
		default:
			return "application/octet-stream";
		}
	}
	
	public static String getFileExt(String contype) {
		if(contype.equalsIgnoreCase("image/vnd.ms-excel")) {
			return ".xls";
		}
		if(contype.equalsIgnoreCase("image//vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
			return ".xlsx";
		}
		if(contype.equalsIgnoreCase("image/jpeg")) {
			return ".jpg";
		}
		if(contype.equalsIgnoreCase("image/png")) {
			return ".png";
		}
		if(contype.equalsIgnoreCase("image/gif")) {
			return ".gif";
		}
		if(contype.equalsIgnoreCase("image/tiff")) {
			return ".tiff";
		}
		if(contype.equalsIgnoreCase("image/bmp")) {
			return ".bmp";
		}
		if(contype.equalsIgnoreCase("image/avi")) {
			return ".avi";
		}
		if(contype.equalsIgnoreCase("image/mpeg")) {
			return ".mpeg";
		}
		if(contype.equalsIgnoreCase("image/zip")) {
			return ".zip";
		}
		if(contype.equalsIgnoreCase("text/plain")) {
			return ".txt";
		}
		if(contype.equalsIgnoreCase("video/mpeg4")) {
			return ".mp3";
		}
		if(contype.equalsIgnoreCase("audio/mp3") || contype.equalsIgnoreCase("audio/mpeg")) {
			return ".mp3";
		}
		
		return "";
	}

}
