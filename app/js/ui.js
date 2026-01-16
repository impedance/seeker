export const UI = {
  setLoader(visible) {
    const spinner = document.getElementById('app-loader');
    if (!spinner) return;
    spinner.style.display = visible ? 'flex' : 'none';
  },
  clearDetails() {
    const panel = document.getElementById('details-panel');
    if (panel) {
      panel.querySelector('.panel-body').textContent = 'Выберите элемент для просмотра';
    }
  }
};
