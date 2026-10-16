// Tab switching
document.querySelectorAll('nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
    btn.classList.add('active');
  });
});

// No pinch zoom on iPhone
['gesturestart', 'gesturechange', 'gestureend'].forEach(name => {
  document.addEventListener(name, e => e.preventDefault());
});