/* Pre-paint theme bootstrap — loaded as a classic (blocking) script from
 * <head> so the dark theme applies before the first paint (no flash).
 * Everything else lives in deferred ES modules. */
(function(){
  var saved=localStorage.getItem('cvGenieDarkMode');
  if(saved==='true'){document.documentElement.classList.add('dark');}
  else if(saved===null&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');}
})();
