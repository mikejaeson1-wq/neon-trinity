package music.neontrinity.tv;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.JavascriptInterface;
import android.media.AudioManager;
public final class MainActivity extends Activity {
 private WebView view;
 private AudioManager audio;
 private final AudioManager.OnAudioFocusChangeListener focus=change->{if(change<0&&view!=null)runOnUiThread(()->view.evaluateJavascript("document.querySelector('audio')?.pause()",null));};
 public final class Bridge {
  @JavascriptInterface public void openSpotify(){runOnUiThread(()->{try{Intent app=getPackageManager().getLaunchIntentForPackage("com.spotify.tv.android");if(app==null)app=getPackageManager().getLaunchIntentForPackage("com.spotify.music");if(app!=null)startActivity(app);else startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.amazon.de/s?k=Spotify+Fire+TV")));}catch(Exception ignored){}});}
  @JavascriptInterface public void playbackChanged(boolean playing){runOnUiThread(()->{if(playing){getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);audio.requestAudioFocus(focus,AudioManager.STREAM_MUSIC,AudioManager.AUDIOFOCUS_GAIN);}else{getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);audio.abandonAudioFocus(focus);}});}
 }
 @Override public void onCreate(Bundle state){super.onCreate(state);audio=(AudioManager)getSystemService(AUDIO_SERVICE);view=new WebView(this);view.setBackgroundColor(0xff101019);view.getSettings().setJavaScriptEnabled(true);view.getSettings().setDomStorageEnabled(true);view.getSettings().setAllowFileAccess(false);view.getSettings().setAllowContentAccess(false);view.getSettings().setMediaPlaybackRequiresUserGesture(false);view.getSettings().setMixedContentMode(0);view.addJavascriptInterface(new Bridge(),"NeonTV");view.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView web,WebResourceRequest request){Uri u=request.getUrl();if("https".equals(u.getScheme())&&"mikejaeson1-wq.github.io".equals(u.getHost())&&u.getPath().startsWith("/neon-trinity/"))return false;try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;}});setContentView(view);view.loadUrl("https://mikejaeson1-wq.github.io/neon-trinity/tv.html");view.requestFocus();}
 @Override public boolean onKeyDown(int key,KeyEvent event){String button=key==KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE?"toggle":key==KeyEvent.KEYCODE_MEDIA_NEXT?"next":key==KeyEvent.KEYCODE_MEDIA_PREVIOUS?"previous":null;if(button!=null){view.evaluateJavascript("document.getElementById('"+button+"')?.click()",null);return true;}return super.onKeyDown(key,event);}
 @Override public void onBackPressed(){if(view.canGoBack())view.goBack();else super.onBackPressed();}
 @Override public void onDestroy(){if(view!=null){view.removeJavascriptInterface("NeonTV");view.destroy();}audio.abandonAudioFocus(focus);super.onDestroy();}
}
