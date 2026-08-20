package com.structural.master;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(PrintPlugin.class);
        registerPlugin(LocalUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        java.io.File updateDir = new java.io.File(getFilesDir(), "local-updates/current");
        if (new java.io.File(updateDir, "index.html").exists()) {
            getBridge().setServerBasePath(updateDir.getAbsolutePath());
        }
    }
}
