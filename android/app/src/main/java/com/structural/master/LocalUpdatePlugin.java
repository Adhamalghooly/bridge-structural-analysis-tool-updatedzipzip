package com.structural.master;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "LocalUpdate")
public class LocalUpdatePlugin extends Plugin {
    private static final String UPDATE_DIR = "local-updates/current";

    @PluginMethod
    public void pickUpdatePackage(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/zip");
        startActivityForResult(call, intent, "packagePicked");
    }

    @PluginMethod
    public void pickUpdateFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        File dir = new File(getContext().getFilesDir(), UPDATE_DIR);
        JSObject result = new JSObject();
        result.put("active", new File(dir, "index.html").exists());
        result.put("path", dir.getAbsolutePath());
        call.resolve(result);
    }

    @PluginMethod
    public void clearUpdate(PluginCall call) {
        File dir = new File(getContext().getFilesDir(), "local-updates");
        deleteRecursive(dir);
        getBridge().setServerAssetPath("public");
        call.resolve();
    }

    @ActivityCallback
    private void packagePicked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("تم إلغاء اختيار ملف التحديث");
            return;
        }
        try {
            installZip(result.getData().getData());
            activate(call);
        } catch (Exception e) {
            call.reject("فشل تثبيت حزمة التحديث: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("تم إلغاء اختيار مجلد التحديث");
            return;
        }
        try {
            Uri treeUri = result.getData().getData();
            copyTree(DocumentFile.fromTreeUri(getContext(), treeUri), new File(getContext().getFilesDir(), UPDATE_DIR));
            validateUpdate();
            activate(call);
        } catch (Exception e) {
            call.reject("فشل تحميل مجلد التحديث: " + e.getMessage());
        }
    }

    private void activate(PluginCall call) throws Exception {
        validateUpdate();
        File dir = new File(getContext().getFilesDir(), UPDATE_DIR);
        getBridge().setServerBasePath(dir.getAbsolutePath());
        JSObject result = new JSObject();
        result.put("active", true);
        result.put("path", dir.getAbsolutePath());
        call.resolve(result);
        getBridge().getWebView().postDelayed(() -> getBridge().reload(), 250);
    }

    private void validateUpdate() throws Exception {
        File index = new File(getContext().getFilesDir(), UPDATE_DIR + "/index.html");
        if (!index.exists()) throw new Exception("يجب أن يحتوي الملف أو المجلد على index.html");
    }

    private void installZip(Uri uri) throws Exception {
        File target = new File(getContext().getFilesDir(), UPDATE_DIR);
        deleteRecursive(target);
        target.mkdirs();
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ZipInputStream zip = new ZipInputStream(input)) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName().replace('\\', '/');
                if (name.contains("..") || name.startsWith("/")) throw new Exception("مسار غير آمن داخل الحزمة");
                File output = new File(target, name);
                if (entry.isDirectory()) {
                    output.mkdirs();
                } else {
                    File parent = output.getParentFile();
                    if (parent != null) parent.mkdirs();
                    try (OutputStream out = new FileOutputStream(output)) {
                        int count;
                        while ((count = zip.read(buffer)) != -1) out.write(buffer, 0, count);
                    }
                }
                zip.closeEntry();
            }
        }
    }

    private void copyTree(DocumentFile source, File target) throws Exception {
        if (source == null || !source.isDirectory()) throw new Exception("المجلد غير صالح");
        deleteRecursive(target);
        target.mkdirs();
        copyChildren(source, target);
    }

    private void copyChildren(DocumentFile source, File target) throws Exception {
        for (DocumentFile child : source.listFiles()) {
            String name = child.getName();
            if (name == null || name.contains("..") || name.startsWith("/")) continue;
            File dest = new File(target, name);
            if (child.isDirectory()) {
                dest.mkdirs();
                copyChildren(child, dest);
            } else {
                try (InputStream in = getContext().getContentResolver().openInputStream(child.getUri());
                     OutputStream out = new FileOutputStream(dest)) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                }
            }
        }
    }

    private void deleteRecursive(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteRecursive(child);
        }
        file.delete();
    }
}