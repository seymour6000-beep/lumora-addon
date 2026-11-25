package ca.lumora.tv;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Lumora for TV: a full-screen window onto your Lumora server.
 * The remote's arrows and OK go straight to the page, Back goes back inside Lumora, Menu changes the server address.
 */
public class MainActivity extends Activity {
    private static final int BG = Color.parseColor("#0c171d");
    private static final int INK = Color.parseColor("#e6eef0");
    private static final int MUTED = Color.parseColor("#8ea5ac");
    private static final int ACCENT = Color.parseColor("#ffc233");

    private SharedPreferences prefs;
    private FrameLayout root;
    private WebView web;
    private LinearLayout setup;
    private LinearLayout problem;
    private EditText address;
    private TextView setupNote;
    private TextView problemText;
    private String serverUrl = "";
    private boolean loadFailed = false;
    private long lastBack = 0;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private NsdManager nsd;
    private NsdManager.DiscoveryListener discovery;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("lumora", MODE_PRIVATE);
        serverUrl = prefs.getString("url", "");

        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);

        buildWeb();
        buildSetup();
        buildProblem();

        if (serverUrl.isEmpty()) showSetup(); else openServer();
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private TextView label(String t, int sp, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setGravity(Gravity.CENTER);
        if (bold) v.setTypeface(Typeface.DEFAULT_BOLD);
        v.setPadding(0, dp(6), 0, dp(6));
        return v;
    }

    private Button button(String t) {
        Button v = new Button(this);
        v.setText(t);
        v.setTextSize(20);
        v.setAllCaps(false);
        v.setTextColor(Color.BLACK);
        v.setBackgroundColor(ACCENT);
        v.setPadding(dp(28), dp(14), dp(28), dp(14));
        v.setFocusable(true);
        v.setOnFocusChangeListener((x, has) -> {
            x.setBackgroundColor(has ? Color.WHITE : ACCENT);
            x.setScaleX(has ? 1.06f : 1f);
            x.setScaleY(has ? 1.06f : 1f);
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(14);
        v.setLayoutParams(lp);
        return v;
    }

    private LinearLayout panel() {
        LinearLayout p = new LinearLayout(this);
        p.setOrientation(LinearLayout.VERTICAL);
        p.setGravity(Gravity.CENTER);
        p.setBackgroundColor(BG);
        p.setPadding(dp(60), dp(40), dp(60), dp(40));
        p.setVisibility(View.GONE);
        root.addView(p, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        return p;
    }

    private void buildWeb() {
        web = new WebView(this);
        web.setBackgroundColor(BG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " LumoraTV/2.4.2");
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl(), base = Uri.parse(serverUrl);
                return u.getHost() == null || !u.getHost().equalsIgnoreCase(base.getHost());
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) { loadFailed = true; showProblem(); }
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (!loadFailed) { problem.setVisibility(View.GONE); }
                CookieManager.getInstance().flush();
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setVisibility(View.GONE);
    }

    private void buildSetup() {
        setup = panel();
        setup.addView(label("Lumora", 40, INK, true));
        setup.addView(label("Type the address of your Lumora server, for example 192.168.1.50:8080", 20, MUTED, false));
        address = new EditText(this);
        address.setTextSize(24);
        address.setTextColor(INK);
        address.setHintTextColor(MUTED);
        address.setHint("192.168.1.50:8080");
        address.setSingleLine(true);
        address.setImeOptions(EditorInfo.IME_ACTION_DONE);
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(dp(520), ViewGroup.LayoutParams.WRAP_CONTENT);
        alp.topMargin = dp(18);
        setup.addView(address, alp);
        address.setOnEditorActionListener((v, a, e) -> { connect(); return true; });
        Button go = button("Connect");
        go.setOnClickListener(v -> connect());
        setup.addView(go);
        Button find = button("Find my server automatically");
        find.setOnClickListener(v -> discover());
        setup.addView(find);
        setupNote = label("", 18, MUTED, false);
        setup.addView(setupNote);
    }

    private void buildProblem() {
        problem = panel();
        problemText = label("", 24, INK, false);
        problem.addView(problemText);
        Button retry = button("Try again");
        retry.setOnClickListener(v -> openServer());
        problem.addView(retry);
        Button change = button("Change address");
        change.setOnClickListener(v -> showSetup());
        problem.addView(change);
    }

    private void showSetup() {
        stopDiscovery();
        problem.setVisibility(View.GONE);
        setup.setVisibility(View.VISIBLE);
        address.setText(serverUrl.replaceFirst("^https?://", ""));
        setupNote.setText("");
        address.requestFocus();
    }

    private void showProblem() {
        problemText.setText("Can’t reach Lumora at\n" + serverUrl + "\n\nCheck that the TV and the server are on the same network and the Lumora app is running.");
        problem.setVisibility(View.VISIBLE);
        for (int i = 0; i < problem.getChildCount(); i++) { View c = problem.getChildAt(i); if (c instanceof Button) { c.requestFocus(); break; } }
    }

    private void connect() {
        String t = address.getText().toString().trim();
        if (t.isEmpty()) { setupNote.setText("Enter the address first."); return; }
        if (!t.matches("^[a-zA-Z][a-zA-Z0-9+.-]*://.*")) t = "http://" + t;
        Uri u = Uri.parse(t);
        if (u.getHost() == null || u.getHost().isEmpty() || !(t.startsWith("http://") || t.startsWith("https://"))) {
            setupNote.setText("That doesn’t look like an address. Try something like 192.168.1.50:8080");
            return;
        }
        serverUrl = t.replaceAll("/+$", "");
        prefs.edit().putString("url", serverUrl).apply();
        stopDiscovery();
        openServer();
    }

    private void openServer() {
        loadFailed = false;
        setup.setVisibility(View.GONE);
        problem.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        web.loadUrl(serverUrl + "/?tv=1");
        web.requestFocus();
    }

    /* Home Assistant announces itself on the network; Lumora runs on the same machine, on port 8080 */
    private void discover() {
        stopDiscovery();
        setupNote.setText("Looking for Home Assistant on your network…");
        nsd = (NsdManager) getSystemService(Context.NSD_SERVICE);
        discovery = new NsdManager.DiscoveryListener() {
            @Override public void onStartDiscoveryFailed(String t, int c) { ui.post(() -> setupNote.setText("Couldn’t search the network. Type the address instead.")); }
            @Override public void onStopDiscoveryFailed(String t, int c) { }
            @Override public void onDiscoveryStarted(String t) { }
            @Override public void onDiscoveryStopped(String t) { }
            @Override public void onServiceLost(NsdServiceInfo s) { }
            @Override public void onServiceFound(NsdServiceInfo s) {
                try {
                    nsd.resolveService(s, new NsdManager.ResolveListener() {
                        @Override public void onResolveFailed(NsdServiceInfo i, int c) { }
                        @Override public void onServiceResolved(NsdServiceInfo i) {
                            if (i.getHost() == null) return;
                            final String host = i.getHost().getHostAddress();
                            ui.post(() -> { address.setText(host + ":8080"); setupNote.setText("Found Home Assistant at " + host + ". Choose Connect."); stopDiscovery(); });
                        }
                    });
                } catch (Exception ignored) { }
            }
        };
        try {
            nsd.discoverServices("_home-assistant._tcp.", NsdManager.PROTOCOL_DNS_SD, discovery);
            ui.postDelayed(() -> { if (discovery != null) { setupNote.setText("Didn’t find it. Type the address instead."); stopDiscovery(); } }, 12000);
        } catch (Exception e) { setupNote.setText("Couldn’t search the network. Type the address instead."); }
    }

    private void stopDiscovery() {
        if (nsd != null && discovery != null) { try { nsd.stopServiceDiscovery(discovery); } catch (Exception ignored) { } }
        discovery = null;
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_SETTINGS) { showSetup(); return true; }
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (setup.getVisibility() == View.VISIBLE) {
                if (!serverUrl.isEmpty()) { openServer(); return true; }
                finish(); return true;
            }
            if (problem.getVisibility() == View.VISIBLE) { exitOnSecondBack(); return true; }
            // let Lumora handle Back first (close a menu, go back to Devices); leave only from the home screen
            web.evaluateJavascript("(function(){try{return !!(window.tvBack&&window.tvBack())}catch(e){return false}})()", value -> {
                if (!"true".equals(value)) exitOnSecondBack();
            });
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private void exitOnSecondBack() {
        long now = System.currentTimeMillis();
        if (now - lastBack < 2500) { finish(); return; }
        lastBack = now;
        Toast.makeText(this, "Press Back again to leave Lumora", Toast.LENGTH_SHORT).show();
    }

    @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onDestroy() { stopDiscovery(); web.destroy(); super.onDestroy(); }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            View d = getWindow().getDecorView();
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }
}
