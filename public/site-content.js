(function () {
  var lead = document.getElementById("hero-lead");
  if (!document.getElementById("home-title")) return;
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
      // Home keeps the large title only; do not re-insert the published eyebrow.
      fillText(lead, data.hero_lead);
    })
    .catch(function () {});
})();
