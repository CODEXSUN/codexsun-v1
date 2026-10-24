package `in`.codexsun.crm_mobile

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.provider.CallLog
import androidx.activity.result.ActivityResultLauncher
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterFragmentActivity() {
    private val channelPrefix by lazy { getString(R.string.mobile_channel_prefix) }
    private val updateChannel by lazy { "$channelPrefix/app-update" }
    private val secureSessionChannel by lazy { "$channelPrefix/secure-session" }
    private val mobileActionsChannel by lazy { "$channelPrefix/mobile-actions" }
    private val callLogPreferences by lazy { "${packageName}_call_log_access" }
    private val callLogDisclosureKey = "disclosure_accepted"
    private val documentScanner by lazy { GmsDocumentScanning.getClient(
        GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setPageLimit(10)
            .setResultFormats(
                GmsDocumentScannerOptions.RESULT_FORMAT_JPEG,
                GmsDocumentScannerOptions.RESULT_FORMAT_PDF,
            )
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build(),
    ) }
    private lateinit var documentScannerLauncher: ActivityResultLauncher<IntentSenderRequest>
    private lateinit var callLogPermissionLauncher: ActivityResultLauncher<String>
    private var pendingCallLogResult: MethodChannel.Result? = null
    private var pendingCallLogReadMode = CallLogReadMode.FULL

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        documentScannerLauncher = registerForActivityResult(
            ActivityResultContracts.StartIntentSenderForResult(),
        ) { }
        callLogPermissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestPermission(),
        ) { granted ->
            val result = pendingCallLogResult ?: return@registerForActivityResult
            pendingCallLogResult = null
            if (granted) {
                rememberCallLogDisclosure()
                deliverCallLogs(result, pendingCallLogReadMode)
            }
            else result.error("permission_denied", "Call log permission was denied.", null)
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, updateChannel)
            .setMethodCallHandler(::handleUpdateCall)
        val secureSession = SecureSessionManager(this)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, secureSessionChannel)
            .setMethodCallHandler(secureSession::handle)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, mobileActionsChannel)
            .setMethodCallHandler(::handleMobileAction)
    }

    private fun handleMobileAction(call: MethodCall, result: MethodChannel.Result) {
        if (call.method == "hasCallLogAccess") {
            result.success(hasCallLogAccess())
            return
        }
        if (call.method == "callLogs") {
            openCallLogs(result)
            return
        }
        if (call.method == "enquiryCallLogs") {
            openCallLogs(result, CallLogReadMode.NUMBERS_ONLY)
            return
        }
        if (call.method == "scanDocument") {
            openDocumentScanner(result)
            return
        }
        val intent = when (call.method) {
            "call" -> Intent(Intent.ACTION_DIAL, Uri.parse("tel:${call.argument<String>("mobile").orEmpty()}"))
            "sms" -> Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:${call.argument<String>("mobile").orEmpty()}"))
            "whatsApp" -> Intent(
                Intent.ACTION_VIEW,
                whatsAppUri(call),
            )
            "location" -> Intent(
                Intent.ACTION_VIEW,
                Uri.parse("geo:0,0?q=${Uri.encode(call.argument<String>("query").orEmpty())}"),
            )
            "photo" -> Intent("android.media.action.IMAGE_CAPTURE")
            "openAppSettings" -> Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:$packageName"),
            )
            else -> return result.notImplemented()
        }
        try {
            startActivity(intent)
            result.success(true)
        } catch (_: ActivityNotFoundException) {
            result.success(false)
        }
    }

    private fun openCallLogs(
        result: MethodChannel.Result,
        readMode: CallLogReadMode = CallLogReadMode.FULL,
    ) {
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)) {
            result.error("unsupported_device", "This device does not provide telephone call history.", null)
            return
        }
        if (hasCallLogAccess()) {
            deliverCallLogs(result, readMode)
            return
        }
        if (pendingCallLogResult != null) {
            result.error("request_in_progress", "A call log permission request is already active.", null)
            return
        }
        pendingCallLogResult = result
        pendingCallLogReadMode = readMode
        callLogPermissionLauncher.launch(Manifest.permission.READ_CALL_LOG)
    }

    private fun deliverCallLogs(
        result: MethodChannel.Result,
        readMode: CallLogReadMode = CallLogReadMode.FULL,
    ) {
        try {
            rememberCallLogDisclosure()
            result.success(
                if (readMode == CallLogReadMode.NUMBERS_ONLY) {
                    readEnquiryCallLogs()
                } else {
                    readCallLogs()
                },
            )
        } catch (_: SecurityException) {
            result.error(
                "restricted_permission",
                "The installer did not allow call history access for this application.",
                null,
            )
        }
    }

    private fun hasCallLogAccess(): Boolean {
        val granted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.READ_CALL_LOG,
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) rememberCallLogDisclosure()
        return granted
    }

    private fun rememberCallLogDisclosure() {
        getSharedPreferences(callLogPreferences, MODE_PRIVATE)
            .edit()
            .putBoolean(callLogDisclosureKey, true)
            .apply()
    }

    private fun readCallLogs(): List<Map<String, Any?>> {
        val records = mutableListOf<Map<String, Any?>>()
        val projection = arrayOf(
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.NUMBER,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
        )
        contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            projection,
            null,
            null,
            "${CallLog.Calls.DATE} DESC",
        )?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME)
            val numberIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
            val typeIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
            val dateIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)
            val durationIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)
            while (cursor.moveToNext()) {
                records += mapOf(
                    "name" to if (nameIndex >= 0) cursor.getString(nameIndex).orEmpty() else "",
                    "number" to cursor.getString(numberIndex).orEmpty(),
                    "type" to cursor.getInt(typeIndex),
                    "timestamp" to cursor.getLong(dateIndex),
                    "durationSeconds" to cursor.getLong(durationIndex),
                )
            }
        }
        return records
    }

    private fun readEnquiryCallLogs(): List<Map<String, Any?>> {
        val records = mutableListOf<Map<String, Any?>>()
        val projection = arrayOf(
            CallLog.Calls.NUMBER,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
        )
        val uri = CallLog.Calls.CONTENT_URI.buildUpon()
            .appendQueryParameter(
                CallLog.Calls.LIMIT_PARAM_KEY,
                ENQUIRY_CALL_LOG_LIMIT.toString(),
            )
            .build()
        contentResolver.query(
            uri,
            projection,
            "${CallLog.Calls.NUMBER} IS NOT NULL AND ${CallLog.Calls.NUMBER} != ''",
            null,
            "${CallLog.Calls.DATE} DESC",
        )?.use { cursor ->
            val numberIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
            val typeIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
            val dateIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)
            while (cursor.moveToNext() && records.size < ENQUIRY_CALL_LOG_LIMIT) {
                records += mapOf(
                    "number" to cursor.getString(numberIndex).orEmpty(),
                    "type" to cursor.getInt(typeIndex),
                    "timestamp" to cursor.getLong(dateIndex),
                )
            }
        }
        return records
    }

    private fun openDocumentScanner(result: MethodChannel.Result) {
        documentScanner.getStartScanIntent(this)
            .addOnSuccessListener { intentSender ->
                documentScannerLauncher.launch(IntentSenderRequest.Builder(intentSender).build())
                result.success(true)
            }
            .addOnFailureListener { result.success(false) }
    }

    private fun whatsAppNumber(call: MethodCall): String {
        val digits = call.argument<String>("mobile").orEmpty().filter(Char::isDigit)
        return if (digits.length == 10) "91$digits" else digits
    }

    private fun whatsAppUri(call: MethodCall): Uri {
        val number = whatsAppNumber(call)
        return Uri.parse("https://wa.me/$number")
    }

    private fun handleUpdateCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "updateDirectory" -> result.success(File(cacheDir, "updates").apply { mkdirs() }.absolutePath)
            "canInstallPackages" -> result.success(
                Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()
            )
            "openInstallPermission" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
                }
                result.success(null)
            }
            "installApk" -> installApk(call, result)
            else -> result.notImplemented()
        }
    }

    private fun installApk(call: MethodCall, result: MethodChannel.Result) {
        val path = call.argument<String>("path") ?: return result.error("invalid_path", "Missing update path.", null)
        val root = File(cacheDir, "updates").canonicalFile
        val apk = File(path).canonicalFile
        if (!apk.path.startsWith("${root.path}${File.separator}") || !apk.isFile || !apk.name.endsWith(".apk")) {
            return result.error("invalid_path", "Update file is invalid.", null)
        }
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apk)
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivity(intent)
        result.success(null)
    }
}

private enum class CallLogReadMode {
    FULL,
    NUMBERS_ONLY,
}

private const val ENQUIRY_CALL_LOG_LIMIT = 10
