package in.codexsun.cxmobile;

import static org.junit.Assert.*;

import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;

import java.net.URL;

/**
 * Real Java JVM unit tests for NativeSecureStoragePlugin.
 * Tests canonical URI normalization, slash boundary (/api/app/), missing metadata rejection,
 * native-owned key protection, and release security policies directly inside the Java runtime.
 */
public class NativeSecureStoragePluginTest {

    private NativeSecureStoragePlugin plugin;

    @Before
    public void setUp() {
        plugin = new NativeSecureStoragePlugin();
    }

    @Test
    public void testNativeOwnedKeyProtection() {
        // Sensitive session credentials and native bindings must be protected
        assertTrue(plugin.isNativeOwnedKey("codexsun.cxmobile.auth.session_record"));
        assertTrue(plugin.isNativeOwnedKey("codexsun.cxmobile.auth.session_secret"));
        assertTrue(plugin.isNativeOwnedKey("codexsun.cxmobile.auth.active_host"));
        assertTrue(plugin.isNativeOwnedKey("codexsun.cxmobile.auth.api_base_url"));
        assertTrue(plugin.isNativeOwnedKey("codexsun.cxmobile.auth.session_slot"));
        assertTrue(plugin.isNativeOwnedKey("user.token"));
        assertTrue(plugin.isNativeOwnedKey("client.bearer"));

        // Non-auth keys are not native-owned
        assertFalse(plugin.isNativeOwnedKey("codexsun.cxmobile.ui.theme_preference"));
        assertFalse(plugin.isNativeOwnedKey("codexsun.cxmobile.cache.last_sync"));
        assertFalse(plugin.isNativeOwnedKey(null));
    }

    @Test
    public void testSiblingPathEscapeDenial() throws Exception {
        JSONObject sessionObj = new JSONObject();
        sessionObj.put("apiOrigin", "http://127.0.0.1:18010");
        sessionObj.put("apiBaseUrl", "http://127.0.0.1:18010/api/app");

        // Sibling path /api/application must be DENIED
        try {
            plugin.assertValidDestination("http://127.0.0.1:18010/api/application", sessionObj, true);
            fail("Expected SecurityException for sibling path /api/application");
        } catch (SecurityException e) {
            assertTrue(e.getMessage().contains("escapes approved API scope"));
        }

        // Sibling path /api/app-other must be DENIED
        try {
            plugin.assertValidDestination("http://127.0.0.1:18010/api/app-other", sessionObj, true);
            fail("Expected SecurityException for sibling path /api/app-other");
        } catch (SecurityException e) {
            assertTrue(e.getMessage().contains("escapes approved API scope"));
        }
    }

    @Test
    public void testValidScopeDescendants() throws Exception {
        JSONObject sessionObj = new JSONObject();
        sessionObj.put("apiOrigin", "http://127.0.0.1:18010");
        sessionObj.put("apiBaseUrl", "http://127.0.0.1:18010/api/app");

        // Exact match
        URL exact = plugin.assertValidDestination("http://127.0.0.1:18010/api/app", sessionObj, true);
        assertEquals("/api/app", exact.getPath());

        // Exact match with trailing slash
        URL exactSlash = plugin.assertValidDestination("http://127.0.0.1:18010/api/app/", sessionObj, true);
        assertEquals("/api/app/", exactSlash.getPath());

        // Child path
        URL login = plugin.assertValidDestination("http://127.0.0.1:18010/api/app/auth/login", sessionObj, true);
        assertEquals("/api/app/auth/login", login.getPath());

        // Child path
        URL enquiries = plugin.assertValidDestination("http://127.0.0.1:18010/api/app/crm/enquiries", sessionObj, true);
        assertEquals("/api/app/crm/enquiries", enquiries.getPath());
    }

    @Test
    public void testPathTraversalDenial() throws Exception {
        JSONObject sessionObj = new JSONObject();
        sessionObj.put("apiOrigin", "http://127.0.0.1:18010");
        sessionObj.put("apiBaseUrl", "http://127.0.0.1:18010/api/app");

        try {
            plugin.assertValidDestination("http://127.0.0.1:18010/api/app/../../etc/passwd", sessionObj, true);
            fail("Expected SecurityException for path traversal");
        } catch (SecurityException e) {
            assertTrue(e.getMessage().contains("Path traversal denied"));
        }
    }

    @Test
    public void testMissingScopeMetadataDenial() throws Exception {
        // Missing apiOrigin
        JSONObject noOrigin = new JSONObject();
        noOrigin.put("apiBaseUrl", "http://127.0.0.1:18010/api/app");
        try {
            plugin.assertValidDestination("http://127.0.0.1:18010/api/app/crm", noOrigin, true);
            fail("Expected SecurityException when apiOrigin is missing");
        } catch (Exception e) {
            assertTrue(e instanceof SecurityException);
            assertTrue(e.getMessage().contains("Session record is missing required native origin or base-path scope metadata"));
        }

        // Missing apiBaseUrl
        JSONObject noBaseUrl = new JSONObject();
        noBaseUrl.put("apiOrigin", "http://127.0.0.1:18010");
        try {
            plugin.assertValidDestination("http://127.0.0.1:18010/api/app/crm", noBaseUrl, true);
            fail("Expected SecurityException when apiBaseUrl is missing");
        } catch (Exception e) {
            assertTrue(e instanceof SecurityException);
            assertTrue(e.getMessage().contains("Session record is missing required native origin or base-path scope metadata"));
        }
    }

    @Test
    public void testCrossOriginAndHostDenial() throws Exception {
        JSONObject sessionObj = new JSONObject();
        sessionObj.put("apiOrigin", "http://127.0.0.1:18010");
        sessionObj.put("apiBaseUrl", "http://127.0.0.1:18010/api/app");

        // Wrong port
        try {
            plugin.assertValidDestination("http://127.0.0.1:19999/api/app/crm", sessionObj, true);
            fail("Expected SecurityException for foreign port");
        } catch (SecurityException e) {
            assertTrue(e.getMessage().contains("Cross-origin credential injection denied"));
        }

        // Wrong host (HTTP non-loopback is rejected immediately in debug mode)
        try {
            plugin.assertValidDestination("http://evil.invalid:18010/api/app/crm", sessionObj, true);
            fail("Expected SecurityException for foreign HTTP host");
        } catch (SecurityException e) {
            assertTrue(e.getMessage().contains("Insecure HTTP protocol is only permitted for local loopback in debug mode"));
        }

        // Wrong host on HTTPS (rejected by session origin binding)
        try {
            plugin.assertValidDestination("https://evil.invalid:18010/api/app/crm", sessionObj, true);
            fail("Expected SecurityException for foreign host");
        } catch (SecurityException e) {
            assertTrue(e.getMessage().contains("Cross-origin credential injection denied"));
        }
    }

    @Test
    public void testReleaseModeSecurityEnforcement() throws Exception {
        JSONObject sessionObj = new JSONObject();
        sessionObj.put("apiOrigin", "https://api.codexsun.app");
        sessionObj.put("apiBaseUrl", "https://api.codexsun.app/api/app");

        // In release mode (isDebug = false), insecure HTTP must be denied
        try {
            plugin.assertValidDestination("http://api.codexsun.app/api/app/auth/login", sessionObj, false);
            fail("Expected SecurityException for HTTP in release mode");
        } catch (SecurityException e) {
            assertTrue(e.getMessage().contains("Insecure HTTP destination denied in release environment"));
        }

        // In release mode, loopback must be denied
        try {
            JSONObject loopbackObj = new JSONObject();
            loopbackObj.put("apiOrigin", "https://127.0.0.1");
            loopbackObj.put("apiBaseUrl", "https://127.0.0.1/api/app");
            plugin.assertValidDestination("https://127.0.0.1/api/app/auth/login", loopbackObj, false);
            fail("Expected SecurityException for loopback in release mode");
        } catch (SecurityException e) {
            assertTrue(e.getMessage().contains("Loopback and non-routable destinations are denied"));
        }

        // Valid HTTPS in release mode
        URL valid = plugin.assertValidDestination("https://api.codexsun.app/api/app/crm/enquiries", sessionObj, false);
        assertEquals("https", valid.getProtocol());
        assertEquals("api.codexsun.app", valid.getHost());
    }

    @Test
    public void testMalformedAndUnsupportedProtocolDenial() {
        JSONObject sessionObj = new JSONObject();

        // Null / empty URL
        try {
            plugin.assertValidDestination(null, sessionObj, true);
            fail("Expected IllegalArgumentException for null URL");
        } catch (Exception e) {
            assertTrue(e instanceof IllegalArgumentException);
        }

        try {
            plugin.assertValidDestination("   ", sessionObj, true);
            fail("Expected IllegalArgumentException for empty URL");
        } catch (Exception e) {
            assertTrue(e instanceof IllegalArgumentException);
        }

        // Malformed URL
        try {
            plugin.assertValidDestination("not a valid url", sessionObj, true);
            fail("Expected IllegalArgumentException for malformed URL");
        } catch (Exception e) {
            assertTrue(e instanceof IllegalArgumentException);
        }

        // Unsupported protocols (file:, ftp:, javascript:, data:)
        try {
            plugin.assertValidDestination("file:///etc/passwd", sessionObj, true);
            fail("Expected SecurityException for file: protocol");
        } catch (Exception e) {
            assertTrue(e instanceof SecurityException);
            assertTrue(e.getMessage().contains("Insecure or unsupported protocol"));
        }

        try {
            plugin.assertValidDestination("ftp://127.0.0.1:21/api/app", sessionObj, true);
            fail("Expected SecurityException for ftp: protocol");
        } catch (Exception e) {
            assertTrue(e instanceof SecurityException);
            assertTrue(e.getMessage().contains("Insecure or unsupported protocol"));
        }
    }

    @Test
    public void testQueryStringPreservationAndScopeValidation() throws Exception {
        JSONObject sessionObj = new JSONObject();
        sessionObj.put("apiOrigin", "http://127.0.0.1:18010");
        sessionObj.put("apiBaseUrl", "http://127.0.0.1:18010/api/app");

        // Destination with query parameters
        URL validWithQuery = plugin.assertValidDestination(
                "http://127.0.0.1:18010/api/app/billing/quotations?status=draft&page=1&limit=50",
                sessionObj,
                true
        );
        assertEquals("/api/app/billing/quotations", validWithQuery.getPath());
        assertEquals("status=draft&page=1&limit=50", validWithQuery.getQuery());

        // Traversal within query param must also be rejected
        try {
            plugin.assertValidDestination(
                    "http://127.0.0.1:18010/api/app/billing/quotations/../../secret?token=x",
                    sessionObj,
                    true
            );
            fail("Expected SecurityException for path traversal with query");
        } catch (SecurityException e) {
            assertTrue(e.getMessage().contains("Path traversal denied"));
        }
    }
}
