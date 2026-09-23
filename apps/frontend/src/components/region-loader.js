export class RegionLoader {
  during(element, operation) {
    const overlay = document.createElement('div');
    overlay.className = 'region-loader';
    overlay.setAttribute('aria-busy', 'true');
    overlay.innerHTML = '<span class="region-spinner"></span>';

    element.classList.add('is-loading');
    element.appendChild(overlay);

    return Promise.resolve()
      .then(operation)
      .finally(() => {
        overlay.remove();
        element.classList.remove('is-loading');
      });
  }
}

export const regionLoader = new RegionLoader();
