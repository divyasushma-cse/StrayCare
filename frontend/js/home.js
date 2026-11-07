renderTopbar('home');
(async () => {
  try {
    const s = await (await fetch(window.API_BASE + '/stats/public')).json();
    document.getElementById('hero-total').textContent = s.reportsToday;
    document.getElementById('hero-rescued').textContent = s.rescued;
    document.getElementById('hero-resp').textContent = s.responders;
  } catch { /* leave zeros if API is offline */ }
})();
