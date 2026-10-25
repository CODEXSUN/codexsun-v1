package in.codexsun.cxmobile;

import android.os.Bundle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSecureStoragePlugin.class);
        super.onCreate(savedInstanceState);

        // Apply Android 15/16 (API 35/36) Edge-to-Edge System Bar Insets
        // Prevents header from overlapping status bar/clock and footer from overlapping gesture bar
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (view, insets) -> {
            Insets systemBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
    }
}
