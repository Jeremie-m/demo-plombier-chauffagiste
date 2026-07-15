(() => {
  const fallback = window.SITE_FALLBACK || {};
  const at = (object, path) => path.split('.').reduce((value, key) => value && value[key], object);
  const clean = value => typeof value === 'string' ? value.trim() : value;
  const phoneHref = value => `tel:${String(value).replace(/[^+\d]/g, '')}`;
  const phoneLabel = value => String(value).replace(/^\+33/, '0').replace(/(\d{2})(?=\d)/g, '$1 ').trim();

  function render(input = {}) {
    const previewPalette = new URLSearchParams(window.location.search).get('palette');
    const data = {
      business: { ...(fallback.business || {}), ...(input.business || {}) },
      content: { ...(fallback.content || {}), ...(input.content || {}) },
      images: input.images || {},
      map: {
        ...(fallback.map || {}),
        ...(input.map || {}),
        center: { ...(fallback.map?.center || {}), ...(input.map?.center || {}) }
      },
      palette: clean(previewPalette) || clean(input.palette) || fallback.palette || 'default'
    };

    document.documentElement.dataset.palette = data.palette;
    document.querySelectorAll('[data-field]').forEach(node => {
      const value = clean(at(data, node.dataset.field));
      node.textContent = value || at(fallback, node.dataset.field) || '';
    });

    const phone = clean(data.business.phone);
    document.querySelectorAll('[data-phone-link]').forEach(node => {
      if (!phone) { node.hidden = true; return; }
      node.href = phoneHref(phone);
      node.querySelectorAll('[data-phone-text]').forEach(label => { label.textContent = phoneLabel(phone); });
      if (node.matches('[data-phone-text]')) node.textContent = phoneLabel(phone);
    });

    const services = Array.isArray(data.content.services) ? data.content.services.map(clean).filter(Boolean) : [];
    const finalServices = services.length ? services : fallback.content.services;
    document.querySelectorAll('[data-services]').forEach(list => {
      list.replaceChildren(...finalServices.map((service, index) => {
        const item = document.createElement('li');
        const number = document.createElement('span');
        const name = document.createElement('strong');
        number.textContent = String(index + 1).padStart(2, '0');
        name.textContent = service;
        item.append(number, name);
        return item;
      }));
    });

    const faqs = Array.isArray(data.content.faq) ? data.content.faq.filter(item => clean(item?.question) && clean(item?.answer)) : [];
    document.querySelectorAll('[data-faq]').forEach(list => {
      if (!faqs.length) { list.hidden = true; return; }
      list.replaceChildren(...faqs.map(item => {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const answer = document.createElement('p');
        summary.textContent = clean(item.question);
        answer.textContent = clean(item.answer);
        details.append(summary, answer);
        return details;
      }));
    });

    const prices = Array.isArray(data.content.prices) ? data.content.prices.filter(item => clean(item?.label) && clean(item?.price)) : [];
    document.querySelectorAll('[data-prices]').forEach(list => {
      if (!prices.length) { list.hidden = true; return; }
      list.replaceChildren(...prices.map(item => {
        const row = document.createElement('li');
        const label = document.createElement('span');
        const price = document.createElement('strong');
        label.textContent = clean(item.label);
        price.textContent = clean(item.price);
        row.append(label, price);
        return row;
      }));
    });

    const rating = Number(data.business.rating);
    const reviews = Number(data.business.reviews);
    document.querySelectorAll('[data-proof]').forEach(proof => {
      if (!(rating > 0 && reviews > 0)) { proof.hidden = true; return; }
      proof.querySelectorAll('[data-rating]').forEach(node => { node.textContent = rating.toLocaleString('fr-FR', { maximumFractionDigits: 1 }); });
      proof.querySelectorAll('[data-reviews]').forEach(node => { node.textContent = `${reviews.toLocaleString('fr-FR')} avis Google`; });
    });

    document.querySelectorAll('[data-image-wrap]').forEach(wrap => {
      const slot = wrap.dataset.imageWrap;
      const image = wrap.querySelector('[data-image]');
      const source = clean(data.images[slot]);
      const hide = () => { wrap.hidden = true; document.documentElement.classList.add(`no-${slot}-image`); };
      image.addEventListener('error', hide, { once: true });
      if (source) {
        image.src = source;
        if (image.complete && !image.naturalWidth) hide();
      } else hide();
    });

    document.querySelectorAll('[data-service-map]').forEach(wrap => {
      const config = data.map || {};
      const lat = Number(config.center?.lat);
      const lng = Number(config.center?.lng);
      const radiusKm = Number(config.radiusKm);
      const padding = Number(config.padding ?? 1.4);
      const iframe = wrap.querySelector('[data-map-frame]');
      const image = wrap.querySelector('[data-image]');
      const radius = wrap.querySelector('[data-map-radius]');
      const label = wrap.querySelector('[data-map-label]');
      const attribution = wrap.querySelector('[data-map-attribution]');
      const valid = (config.provider || 'openstreetmap') === 'openstreetmap'
        && [lat, lng, radiusKm, padding].every(Number.isFinite)
        && radiusKm > 0
        && padding >= 1;

      if (!valid || !iframe) {
        if (iframe) iframe.hidden = true;
        if (radius) radius.hidden = true;
        if (label) label.hidden = true;
        if (attribution) attribution.hidden = true;
        if (image) image.hidden = false;
        return;
      }

      const latDelta = (radiusKm * padding) / 111.32;
      const lngDelta = (radiusKm * padding) / (111.32 * Math.cos((lat * Math.PI) / 180));
      const bbox = [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta]
        .map(value => value.toFixed(5))
        .join(',');

      iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
      iframe.title = clean(config.title) || `Carte OpenStreetMap centrée sur ${clean(config.city) || 'la zone d’intervention'}`;
      wrap.style.setProperty('--coverage-size', `${Math.min(82, 100 / padding)}%`);
      wrap.setAttribute('aria-label', clean(config.ariaLabel) || iframe.title);
      wrap.hidden = false;
      document.documentElement.classList.remove('no-map-image');
      if (image) image.hidden = true;
      iframe.hidden = false;
      if (radius) radius.hidden = false;
      if (label) {
        label.textContent = clean(config.label) || clean(config.city) || 'Zone d’intervention';
        label.hidden = false;
      }
      if (attribution) attribution.hidden = false;
    });

    document.querySelectorAll('[data-year]').forEach(node => { node.textContent = new Date().getFullYear(); });
    document.title = `${data.business.name || fallback.business.name} — Plombier chauffagiste`;
  }

  fetch('site.json').then(response => response.ok ? response.json() : {}).then(render).catch(() => render());
})();
