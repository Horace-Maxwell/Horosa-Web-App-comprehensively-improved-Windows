package boundless.types;

public enum Type {
	Boolean("Boolean"), Byte("Byte"), Char("Char"), DateTime("DateTime"), Date("Date"), Decimal("Decimal"),
	Int16("Int16"), Int32("Int32"), Int64("Int64"), SByte("SByte"), Single("Single"), String("String"),
	UInt16("UInt16"), UInt32("UInt32"), UInt64("UInt64"), ByteArray("ByteArray"), Double("Double");
	
	private String _type;

	private Type(String type) {
		this._type = type;
	}

	/* (non-Javadoc)
	 * @see java.lang.Enum#toString()
	 */
	@Override
	public String toString() {
		return this._type;
	}
	
	

}
