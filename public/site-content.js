(function () {
  var title = document.getElementById("home-title");
  if (!title) return;
  var map = {
    hero_eyebrow: document.getElementById("hero-eyebrow"),
    hero_title: title,
    hero_lead: document.getElementById("hero-lead"),
    hero_image_alt: document.getElementById("hero-photo"),
    hero_caption_place: document.getElementById("hero-caption-place"),
    hero_caption_title: document.getElementById("hero-caption-title"),
    hero_caption_credit: document.getElementById("hero-caption-credit")
  };
  function fillText(el, value, multiline) {
    if (!el || typeof value !== "string" || !value) return;
    if (!multiline) {
      el.textContent = value;
      return;
    }
    el.replaceChildren();
    value.split("\n").forEach(function (line, i) {
      if (i) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(line));
    });
  }
  fetch("/published-content")
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data) return;
      fillText(map.hero_eyebrow, data.hero_eyebrow);
      fillText(map.hero_title, data.hero_title, true);
      fillText(map.hero_lead, data.hero_lead);
      if (map.hero_image_alt && data.hero_image_alt) map.hero_image_alt.alt = data.hero_image_alt;
      if (map.hero_image_alt && data.hero_image_url && /^(\/img\/[A-Za-z0-9._-]+|\/hero-image)$/.test(data.hero_image_url)) {
        map.hero_image_alt.src = data.hero_image_url;
        if (data.hero_image_url === "/hero-image") map.hero_image_alt.removeAttribute("srcset");
        var hero = document.querySelector(".hero");
        if (hero) hero.classList.add("has-custom-image");
      }
      fillText(map.hero_caption_place, data.hero_caption_place);
      fillText(map.hero_caption_title, data.hero_caption_title);
      fillText(map.hero_caption_credit, data.hero_caption_credit);
    })
    .catch(function () {});
})();
