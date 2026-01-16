export function registerSearch(handler) {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', (event) => {
    handler(event.target.value);
  });
}
