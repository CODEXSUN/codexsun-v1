package in.codexsun.cxmobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/**
 * Native hardware-backed secure storage plugin using Android KeyStore (TEE / StrongBox).
 * Secrets are encrypted with AES-256-GCM using hardware-isolated keys.
 * Raw secret credentials are NEVER stored in plaintext SharedPreferences or localStorage,
 * and decrypted bearer tokens NEVER cross the JavaScript bridge into web memory.
 */
@CapacitorPlugin(name = "NativeSecureStorage")
public class NativeSecureStoragePlugin extends Plugin {

    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "CXMobileMasterKey";
    private static final String VAULT_PREFS = "cxmobile_hardware_vault";
    private static final String CIPHER_TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int GCM_IV_LENGTH = 12;

    private synchronized SecretKey getOrCreateMasterKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        if (!keyStore.containsAlias(KEY_ALIAS)) {
            KeyGenerator keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    ANDROID_KEYSTORE
            );

            KeyGenParameterSpec keyGenParameterSpec = new KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setRandomizedEncryptionRequired(true)
                    .build();

            keyGenerator.init(keyGenParameterSpec);
            return keyGenerator.generateKey();
        }

        return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }

    private String encryptInternal(String value) throws Exception {
        SecretKey secretKey = getOrCreateMasterKey();
        Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);

        byte[] iv = cipher.getIV();
        byte[] cipherText = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));

        byte[] combined = new byte[iv.length + cipherText.length];
        System.arraycopy(iv, 0, combined, 0, iv.length);
        System.arraycopy(cipherText, 0, combined, iv.length, cipherText.length);

        return Base64.encodeToString(combined, Base64.NO_WRAP);
    }

    private String decryptInternal(String encoded) throws Exception {
        if (encoded == null) return null;
        byte[] combined = Base64.decode(encoded, Base64.NO_WRAP);
        if (combined.length < GCM_IV_LENGTH) return null;

        byte[] iv = new byte[GCM_IV_LENGTH];
        byte[] cipherText = new byte[combined.length - GCM_IV_LENGTH];
        System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);
        System.arraycopy(combined, GCM_IV_LENGTH, cipherText, 0, cipherText.length);

        SecretKey secretKey = getOrCreateMasterKey();
        Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
        GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);

        byte[] decrypted = cipher.doFinal(cipherText);
        return new String(decrypted, StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void setSecret(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");

        if (key == null || value == null) {
            call.reject("Key and value are required");
            return;
        }

        try {
            String encoded = encryptInternal(value);
            SharedPreferences prefs = getContext().getSharedPreferences(VAULT_PREFS, Context.MODE_PRIVATE);
            prefs.edit().putString(key, encoded).apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to encrypt and store secret in Android KeyStore: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getSecret(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Key is required");
            return;
        }

        // XR01: Session bearer secret must NEVER cross the JavaScript bridge into web memory.
        if (key.endsWith("auth.session_secret") || key.endsWith(".token") || key.endsWith(".bearer")) {
            JSObject ret = new JSObject();
            ret.put("value", "[native-isolated]");
            call.resolve(ret);
            return;
        }

        try {
            SharedPreferences prefs = getContext().getSharedPreferences(VAULT_PREFS, Context.MODE_PRIVATE);
            String encoded = prefs.getString(key, null);

            if (encoded == null) {
                JSObject ret = new JSObject();
                ret.put("value", null);
                call.resolve(ret);
                return;
            }

            String plaintext = decryptInternal(encoded);
            if (plaintext == null) {
                JSObject ret = new JSObject();
                ret.put("value", null);
                call.resolve(ret);
                return;
            }

            // If retrieving session record, sanitize the token field so raw bearer tokens never cross bridge
            if (key.endsWith("auth.session_record")) {
                try {
                    JSONObject sessionObj = new JSONObject(plaintext);
                    if (sessionObj.has("token")) {
                        sessionObj.put("token", "[native-isolated]");
                    }
                    if (sessionObj.has("accessToken")) {
                        sessionObj.put("accessToken", "[native-isolated]");
                    }
                    plaintext = sessionObj.toString();
                } catch (Exception ignored) {
                }
            }

            JSObject ret = new JSObject();
            ret.put("value", plaintext);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to decrypt secret from Android KeyStore: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void removeSecret(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Key is required");
            return;
        }

        SharedPreferences prefs = getContext().getSharedPreferences(VAULT_PREFS, Context.MODE_PRIVATE);
        prefs.edit().remove(key).apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearSecrets(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(VAULT_PREFS, Context.MODE_PRIVATE);
        prefs.edit().clear().apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void executeAuthenticatedRequest(PluginCall call) {
        performAuthenticatedRequest(call);
    }

    /**
     * Validates destination URL, protocol, and binds scope natively against
     * the approved session origin and base path BEFORE opening a network connection.
     */
    private URL assertValidDestination(String urlString, JSONObject sessionObj) throws Exception {
        if (urlString == null || urlString.trim().isEmpty()) {
            throw new IllegalArgumentException("Destination URL is required.");
        }

        URL destUrl;
        try {
            destUrl = new URL(urlString.trim());
        } catch (MalformedURLException e) {
            throw new IllegalArgumentException("Malformed destination URL: " + urlString, e);
        }

        String protocol = destUrl.getProtocol().toLowerCase();
        boolean isDebug = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;

        if (!protocol.equals("http") && !protocol.equals("https")) {
            throw new SecurityException("Insecure or unsupported protocol: " + protocol);
        }

        String host = destUrl.getHost().toLowerCase();
        int port = destUrl.getPort();

        // Release security: HTTP and loopbacks are strictly forbidden in production
        if (!isDebug) {
            if (!protocol.equals("https")) {
                throw new SecurityException("Insecure HTTP destination denied in release environment.");
            }
            if (host.equals("127.0.0.1") || host.equals("localhost") || host.equals("0.0.0.0") ||
                host.equals("[::1]") || host.equals("::1") || host.endsWith(".local") ||
                host.endsWith(".internal") || host.endsWith(".invalid") || host.endsWith(".test") || host.endsWith(".example")) {
                throw new SecurityException("Loopback and non-routable destinations are denied in release environment: " + host);
            }
        } else {
            // In debug mode, allow loopback on HTTP for local Docker testing
            if (protocol.equals("http")) {
                if (!host.equals("127.0.0.1") && !host.equals("localhost") && !host.equals("10.0.2.2")) {
                    throw new SecurityException("Insecure HTTP protocol is only permitted for local loopback in debug mode.");
                }
            }
        }

        // Path traversal denial on raw URL string and normalized path
        String path = destUrl.getPath();
        if (urlString.contains("/..") || urlString.contains("../") || urlString.contains("..") ||
            urlString.toLowerCase().contains("%2e%2e") || path.contains("..")) {
            throw new SecurityException("Path traversal denied: " + path);
        }

        // Native session scope and origin binding
        if (sessionObj != null) {
            String approvedOrigin = sessionObj.optString("apiOrigin", null);
            String approvedBaseUrl = sessionObj.optString("apiBaseUrl", null);
            String approvedHost = sessionObj.optString("loginHost", null);

            // 1. Origin match
            if (approvedOrigin != null && !approvedOrigin.isEmpty()) {
                URL originUrl = new URL(approvedOrigin);
                boolean hostMatches = host.equalsIgnoreCase(originUrl.getHost());
                boolean protoMatches = protocol.equalsIgnoreCase(originUrl.getProtocol());
                int destEffectivePort = port != -1 ? port : destUrl.getDefaultPort();
                int originEffectivePort = originUrl.getPort() != -1 ? originUrl.getPort() : originUrl.getDefaultPort();

                if (!hostMatches || !protoMatches || destEffectivePort != originEffectivePort) {
                    throw new SecurityException("Destination origin '" + protocol + "://" + host + ":" + destEffectivePort +
                            "' does not match approved session origin '" + approvedOrigin + "'. Cross-origin credential injection denied.");
                }
            } else if (approvedHost != null && !approvedHost.isEmpty()) {
                String cleanApprovedHost = approvedHost.replaceAll("^https?://", "").replaceAll("/.*$", "");
                String destHostPort = port != -1 ? (host + ":" + port) : host;
                if (!destHostPort.equalsIgnoreCase(cleanApprovedHost) && !host.equalsIgnoreCase(cleanApprovedHost)) {
                    throw new SecurityException("Destination host '" + destHostPort + "' does not match approved session host '" + cleanApprovedHost + "'.");
                }
            }

            // 2. Base path scope match
            if (approvedBaseUrl != null && !approvedBaseUrl.isEmpty()) {
                URL baseUrl = new URL(approvedBaseUrl);
                String basePath = baseUrl.getPath().replaceAll("/+$", "");
                if (!basePath.isEmpty() && !path.startsWith(basePath)) {
                    throw new SecurityException("Destination path '" + path + "' escapes approved API scope '" + basePath + "'. Scope escape denied.");
                }
            }
        }

        return destUrl;
    }

    /**
     * Executes authenticated HTTP requests natively inside the Android runtime.
     * Decrypts the session token in Java memory using Android KeyStore and injects
     * the Authorization header directly into HttpURLConnection.
     * The raw decrypted Bearer token NEVER crosses the JavaScript bridge into web memory.
     */
    @PluginMethod
    public void performAuthenticatedRequest(PluginCall call) {
        String urlString = call.getString("url");
        String method = call.getString("method", "GET").toUpperCase();
        JSObject headers = call.getObject("headers", new JSObject());
        String body = call.getString("body", null);
        int timeoutMs = call.getInt("timeoutMs", 15000);
        String secretKeyParam = call.getString("secretKey", "codexsun.cxmobile.auth.session_secret");

        if (urlString == null) {
            call.reject("URL is required");
            return;
        }

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                // 1. Resolve stored token and session from Android KeyStore vault in Java memory only
                SharedPreferences prefs = getContext().getSharedPreferences(VAULT_PREFS, Context.MODE_PRIVATE);
                String sessionRecordEncoded = prefs.getString("codexsun.cxmobile.auth.session_record", null);
                JSONObject sessionObj = null;
                String token = null;
                String sessionSlot = null;

                if (sessionRecordEncoded != null) {
                    String jsonString = decryptInternal(sessionRecordEncoded);
                    if (jsonString != null) {
                        sessionObj = new JSONObject(jsonString);
                        if (sessionObj.has("token")) {
                            token = sessionObj.optString("token", null);
                        }
                        if (sessionObj.has("sessionSlot")) {
                            sessionSlot = sessionObj.optString("sessionSlot", null);
                        }
                    }
                }

                if (token == null || token.isEmpty() || token.equals("[native-isolated]")) {
                    String secretEncoded = prefs.getString(secretKeyParam, null);
                    if (secretEncoded == null && !secretKeyParam.equals("codexsun.cxmobile.auth.session_secret")) {
                        secretEncoded = prefs.getString("codexsun.cxmobile.auth.session_secret", null);
                    }
                    if (secretEncoded != null) {
                        token = decryptInternal(secretEncoded);
                    }
                }

                if (token == null || token.isEmpty() || token.equals("[native-isolated]")) {
                    call.reject("Native authenticated transport denied: No active authenticated session or token in KeyStore.");
                    return;
                }

                // 2. Validate destination URL and bind scope natively BEFORE opening connection
                URL destUrl = assertValidDestination(urlString, sessionObj);

                // 3. Open HTTP connection
                conn = (HttpURLConnection) destUrl.openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(timeoutMs);
                conn.setReadTimeout(timeoutMs);
                conn.setUseCaches(false);
                // Keep redirects disabled to prevent token exfiltration via open redirects
                conn.setInstanceFollowRedirects(false);

                // Set headers passed from JS, denying caller overrides of credential/scope headers
                if (headers != null) {
                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        String lowerK = k.toLowerCase();
                        if (lowerK.equals("authorization") || lowerK.equals("x-codexsun-session-slot")) {
                            // Deny caller overriding Authorization or session slot
                            continue;
                        }
                        conn.setRequestProperty(k, headers.getString(k));
                    }
                }

                // 4. Inject native-owned credentials directly into request in Java memory
                // The decrypted Bearer token is NEVER passed back to the JavaScript layer!
                conn.setRequestProperty("Authorization", "Bearer " + token);
                if (sessionSlot != null && !sessionSlot.isEmpty()) {
                    conn.setRequestProperty("x-codexsun-session-slot", sessionSlot);
                }

                // 5. Send body if present
                if (body != null && ("POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method))) {
                    conn.setDoOutput(true);
                    byte[] input = body.getBytes(StandardCharsets.UTF_8);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(input, 0, input.length);
                        os.flush();
                    }
                }

                // 6. Read response
                int statusCode = conn.getResponseCode();
                InputStream is = (statusCode >= 200 && statusCode < 400)
                        ? conn.getInputStream()
                        : conn.getErrorStream();

                StringBuilder responseBuilder = new StringBuilder();
                if (is != null) {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                        char[] buf = new char[4096];
                        int r;
                        while ((r = reader.read(buf)) != -1) {
                            responseBuilder.append(buf, 0, r);
                        }
                    }
                }

                // Read and FILTER response headers: never return Set-Cookie or auth headers to JS!
                JSObject responseHeaders = new JSObject();
                Map<String, List<String>> map = conn.getHeaderFields();
                if (map != null) {
                    for (Map.Entry<String, List<String>> entry : map.entrySet()) {
                        if (entry.getKey() != null && entry.getValue() != null && !entry.getValue().isEmpty()) {
                            String headerKey = entry.getKey().toLowerCase();
                            if (headerKey.equals("set-cookie") ||
                                headerKey.equals("set-cookie2") ||
                                headerKey.equals("authorization") ||
                                headerKey.equals("cookie") ||
                                headerKey.equals("proxy-authenticate") ||
                                headerKey.equals("x-auth-token")) {
                                continue;
                            }
                            responseHeaders.put(headerKey, String.join(", ", entry.getValue()));
                        }
                    }
                }

                JSObject ret = new JSObject();
                ret.put("status", statusCode);
                ret.put("data", responseBuilder.toString());
                ret.put("headers", responseHeaders);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Native authenticated HTTP transport error: " + e.getMessage(), e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }).start();
    }

    /**
     * Executes login natively inside the Android runtime.
     * Transports credentials securely, receives the server response in Java memory,
     * encrypts the raw bearer token directly into KeyStore vault, and returns
     * only sanitized session metadata (with token redacted to "[native-isolated]")
     * to the JavaScript bridge.
     */
    @PluginMethod
    public void performNativeLogin(PluginCall call) {
        String urlString = call.getString("url");
        String desk = call.getString("desk", "tenant");
        JSObject credentials = call.getObject("credentials", new JSObject());
        int timeoutMs = call.getInt("timeoutMs", 15000);

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                // 1. Destination validation (no sessionObj required for initial login)
                URL destUrl = assertValidDestination(urlString, null);

                // 2. Open connection
                conn = (HttpURLConnection) destUrl.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(timeoutMs);
                conn.setReadTimeout(timeoutMs);
                conn.setUseCaches(false);
                conn.setInstanceFollowRedirects(false);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("x-auth-desk", desk);
                conn.setRequestProperty("x-auth-token-delivery", "bearer");

                // Construct JSON request
                JSONObject reqBody = new JSONObject();
                reqBody.put("desk", desk);
                if (credentials != null) {
                    if (credentials.has("identifier")) {
                        reqBody.put("identifier", credentials.getString("identifier"));
                    }
                    if (credentials.has("email")) {
                        reqBody.put("email", credentials.getString("email"));
                    }
                    if (credentials.has("password")) {
                        reqBody.put("password", credentials.getString("password"));
                    }
                    if (credentials.has("corporateId")) {
                        reqBody.put("corporateId", credentials.getString("corporateId"));
                        reqBody.put("tenantCode", credentials.getString("corporateId"));
                    }
                }

                conn.setDoOutput(true);
                byte[] input = reqBody.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(input, 0, input.length);
                    os.flush();
                }

                int statusCode = conn.getResponseCode();
                InputStream is = (statusCode >= 200 && statusCode < 400)
                        ? conn.getInputStream()
                        : conn.getErrorStream();

                StringBuilder responseBuilder = new StringBuilder();
                if (is != null) {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                        char[] buf = new char[4096];
                        int r;
                        while ((r = reader.read(buf)) != -1) {
                            responseBuilder.append(buf, 0, r);
                        }
                    }
                }

                String responseStr = responseBuilder.toString();
                JSONObject respJson = new JSONObject(responseStr);

                if (statusCode >= 200 && statusCode < 300 && respJson.optBoolean("success", false) && respJson.has("data")) {
                    JSONObject data = respJson.getJSONObject("data");
                    String rawToken = data.optString("accessToken", data.optString("token", null));
                    String sessionSlot = data.optString("sessionSlot", null);

                    SharedPreferences prefs = getContext().getSharedPreferences(VAULT_PREFS, Context.MODE_PRIVATE);
                    SharedPreferences.Editor editor = prefs.edit();

                    // Encrypt raw bearer token directly in KeyStore vault
                    if (rawToken != null && !rawToken.isEmpty()) {
                        editor.putString("codexsun.cxmobile.auth.session_secret", encryptInternal(rawToken));
                    }
                    if (sessionSlot != null && !sessionSlot.isEmpty()) {
                        editor.putString("codexsun.cxmobile.auth.session_slot", encryptInternal(sessionSlot));
                    }

                    // Store active host and base URL
                    String activeHost = destUrl.getHost() + (destUrl.getPort() != -1 ? (":" + destUrl.getPort()) : "");
                    editor.putString("codexsun.cxmobile.auth.active_host", encryptInternal(activeHost));

                    // Redact token in session record before storing or returning
                    data.put("token", "[native-isolated]");
                    if (data.has("accessToken")) {
                        data.put("accessToken", "[native-isolated]");
                    }

                    editor.putString("codexsun.cxmobile.auth.session_record", encryptInternal(data.toString()));
                    editor.apply();

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("data", JSObject.fromJSONObject(data));
                    call.resolve(ret);
                } else {
                    String errMsg = "Login failed";
                    if (respJson.has("error")) {
                        JSONObject err = respJson.getJSONObject("error");
                        errMsg = err.optString("message", errMsg);
                    }
                    call.reject(errMsg, String.valueOf(statusCode));
                }
            } catch (Exception e) {
                call.reject("Native login error: " + e.getMessage(), e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }).start();
    }

    @PluginMethod
    public void performNativeLogout(PluginCall call) {
        String urlString = call.getString("url");
        int timeoutMs = call.getInt("timeoutMs", 10000);

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                SharedPreferences prefs = getContext().getSharedPreferences(VAULT_PREFS, Context.MODE_PRIVATE);
                String sessionRecordEncoded = prefs.getString("codexsun.cxmobile.auth.session_record", null);
                JSONObject sessionObj = null;
                String token = null;

                if (sessionRecordEncoded != null) {
                    String json = decryptInternal(sessionRecordEncoded);
                    if (json != null) {
                        sessionObj = new JSONObject(json);
                    }
                }
                String secretEncoded = prefs.getString("codexsun.cxmobile.auth.session_secret", null);
                if (secretEncoded != null) {
                    token = decryptInternal(secretEncoded);
                }

                if (urlString != null && !urlString.isEmpty() && token != null) {
                    try {
                        URL destUrl = assertValidDestination(urlString, sessionObj);
                        conn = (HttpURLConnection) destUrl.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setConnectTimeout(timeoutMs);
                        conn.setReadTimeout(timeoutMs);
                        conn.setInstanceFollowRedirects(false);
                        conn.setRequestProperty("Authorization", "Bearer " + token);
                        conn.getResponseCode();
                    } catch (Exception ignored) {
                    }
                }

                // Wipe all vault secrets immediately
                prefs.edit().clear().apply();

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Native logout error: " + e.getMessage(), e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }).start();
    }

    @PluginMethod
    public void performNativeRestore(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(VAULT_PREFS, Context.MODE_PRIVATE);
            String sessionRecordEncoded = prefs.getString("codexsun.cxmobile.auth.session_record", null);

            if (sessionRecordEncoded == null) {
                JSObject ret = new JSObject();
                ret.put("session", null);
                call.resolve(ret);
                return;
            }

            String json = decryptInternal(sessionRecordEncoded);
            if (json == null) {
                JSObject ret = new JSObject();
                ret.put("session", null);
                call.resolve(ret);
                return;
            }

            JSONObject sessionObj = new JSONObject(json);
            // Redact token
            sessionObj.put("token", "[native-isolated]");
            if (sessionObj.has("accessToken")) {
                sessionObj.put("accessToken", "[native-isolated]");
            }

            JSObject ret = new JSObject();
            ret.put("session", JSObject.fromJSONObject(sessionObj));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Native restore error: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void performNativeRevoke(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(VAULT_PREFS, Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Native revoke error: " + e.getMessage(), e);
        }
    }
}
