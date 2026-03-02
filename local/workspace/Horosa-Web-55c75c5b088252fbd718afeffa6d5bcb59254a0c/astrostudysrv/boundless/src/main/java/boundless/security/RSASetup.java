package boundless.security;

import boundless.exception.UnimplementedException;

public interface RSASetup {
	default void setPublicKey(String pubicModulus, String pubicExp){ throw new UnimplementedException(); }
	default void setPrivateKey(String privateModulus, String privateExp){ throw new UnimplementedException(); }
	default void setUseRSA(boolean value){ throw new UnimplementedException(); }
}
