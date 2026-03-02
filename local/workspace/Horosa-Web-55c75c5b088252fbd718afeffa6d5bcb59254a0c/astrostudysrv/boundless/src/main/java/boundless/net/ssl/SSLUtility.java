package boundless.net.ssl;

import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.security.KeyPair;
import java.security.KeyStore;
import java.security.Security;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.openssl.*;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.bouncycastle.openssl.jcajce.JcePEMDecryptorProviderBuilder;

import boundless.utility.StringUtility;

public class SSLUtility {
	
	public static SSLSocketFactory getSocketFactory(final byte[] caCrtFileRaw) throws Exception{
		return getSocketFactory(caCrtFileRaw, null, null, null, null);
	}
	
    public static SSLSocketFactory getSocketFactory(final byte[] caCrtFileRaw, final byte[] crtFileRaw, final byte[] keyFileRaw,
            final String password, String sslVer) throws Exception {
        Security.addProvider(new BouncyCastleProvider());

        // load CA certificate
        PEMParser pemParser = new PEMParser(new InputStreamReader(new ByteArrayInputStream(caCrtFileRaw)));
        X509CertificateHolder certHolder = (X509CertificateHolder) pemParser.readObject();
        JcaX509CertificateConverter certconverter = new JcaX509CertificateConverter();
        X509Certificate caCert = certconverter.getCertificate(certHolder);
        pemParser.close();

        // load client certificate
        X509Certificate cert = null;
        if(crtFileRaw != null && crtFileRaw.length != 0) {
            pemParser = new PEMParser(new InputStreamReader(new ByteArrayInputStream(crtFileRaw)));
            certHolder = (X509CertificateHolder) pemParser.readObject();        	
            pemParser.close();
            cert = certconverter.getCertificate(certHolder);
        }

        char[] pwd;
        if(StringUtility.isNullOrEmpty(password)){
        	pwd = new char[0];
        }else{
        	pwd = password.toCharArray();
        }
        // load client private key
        KeyPair key;
        if(keyFileRaw == null || keyFileRaw.length == 0){
    	   key = null;
        }else{
            pemParser = new PEMParser(new InputStreamReader(new ByteArrayInputStream(keyFileRaw)));
            PEMDecryptorProvider decProv = new JcePEMDecryptorProviderBuilder().build(password.toCharArray());
            JcaPEMKeyConverter converter = new JcaPEMKeyConverter().setProvider("BC");
            Object object = pemParser.readObject();
            if (object instanceof PEMEncryptedKeyPair) {
                System.out.println("Encrypted key - we will use provided password");
                key = converter.getKeyPair(((PEMEncryptedKeyPair) object).decryptKeyPair(decProv));
            } else {
                System.out.println("Unencrypted key - no password needed");
                key = converter.getKeyPair((PEMKeyPair) object);
            }
            pemParser.close();
        }

        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        // CA certificate is used to authenticate server
        KeyStore caKs = KeyStore.getInstance(KeyStore.getDefaultType());
        caKs.load(null, null);
        caKs.setCertificateEntry("ca-certificate", caCert);
        tmf.init(caKs);

        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        if(cert != null) {
            // client key and certificates are sent to server so it can authenticate us
            KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
            ks.load(null, null);
            ks.setCertificateEntry("certificate", cert);
            if(key != null){
                ks.setKeyEntry("private-key", key.getPrivate(), pwd, new java.security.cert.Certificate[] { cert });
            }
            kmf.init(ks, pwd);        	
        }

        String ver = "TLSv1.2";
        if(!StringUtility.isNullOrEmpty(sslVer)) {
        	ver = sslVer;
        }
        // finally, create SSL socket factory
        SSLContext context = SSLContext.getInstance(ver);
        TrustManager[] trustMgmts = tmf.getTrustManagers();
        if(key == null){
            context.init(null, trustMgmts, null);
        }else{
            context.init(kmf.getKeyManagers(), trustMgmts, null);
        }
 
        return context.getSocketFactory();
    }
    
    public static TrustManager[] getDumyTrustManagers() {
    	TrustManager[] trustManagerArray = { new X509TrustManager() {
            @Override
            public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {

            }

            @Override
            public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {

            }

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                return new X509Certificate[0];
            }
        }};
    	
    	return trustManagerArray;
    }
   
}