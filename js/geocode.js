/**
 * geocode.js — Nominatim autocomplete.
 */

// Kontaktadresse für die Nominatim-Nutzungsrichtlinie.
// Bitte durch Ihre eigene E-Mail-Adresse ersetzen.
var NOMINATIM_CONTACT_EMAIL = 'ihre-email@example.com';

// Mindestabstand zwischen zwei Nominatim-Anfragen (Policy: max. 1 Anfrage/Sekunde).
var NOMINATIM_MIN_INTERVAL_MS = 1100;

window.Geocoder = {
  _timer: null,
  _selectedResult: null,
  _inputEl: null,
  _dropdownEl: null,
  _lastRequestTs: 0,

  init: function (inputEl, dropdownEl, onSelect) {
    var self = this;
    self._inputEl = inputEl;
    self._dropdownEl = dropdownEl;

    inputEl.addEventListener('input', function () {
      var value = inputEl.value.trim();

      if (self._selectedResult && value !== self._selectedResult.displayName) {
        self._selectedResult = null;
        if (typeof onSelect === 'function') {
          onSelect(null);
        }
      }

      if (self._timer) {
        clearTimeout(self._timer);
        self._timer = null;
      }

      if (value.length < 3) {
        self._clearDropdown();
        return;
      }

      var sinceLast = Date.now() - self._lastRequestTs;
      var wait = Math.max(450, NOMINATIM_MIN_INTERVAL_MS - sinceLast);

      self._timer = setTimeout(function () {
        self._lastRequestTs = Date.now();
        self._fetch(value, onSelect);
      }, wait);
    });

    inputEl.addEventListener('blur', function () {
      setTimeout(function () {
        self._clearDropdown();
      }, 200);
    });

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        self._clearDropdown();
      }
    });
  },

  _buildUrl: function (query) {
    return 'https://nominatim.openstreetmap.org/search' +
           '?format=jsonv2' +
           '&limit=10' +
           '&addressdetails=1' +
           '&q=' + encodeURIComponent(query) +
           '&email=' + encodeURIComponent(NOMINATIM_CONTACT_EMAIL);
  },

  _isGolf: function (r) {
    return (r.type === 'golf_course') ||
           (r.class === 'leisure' && r.type === 'golf_course') ||
           (r.category === 'leisure' && r.type === 'golf_course');
  },

  _query: function (q) {
    return fetch(this._buildUrl(q)).then(function (resp) {
      if (resp.status === 403 || resp.status === 429) {
        var e = new Error('blocked');
        e.blocked = true;
        throw e;
      }
      return resp.ok ? resp.json() : [];
    });
  },

  _fetch: function (query, onSelect) {
    var self = this;

    self._query(query)
      .then(function (primary) {
        if (primary && primary.length > 0) {
          return primary;
        }
        if (query.toLowerCase().indexOf('golf') !== -1) {
          return primary;
        }
        self._lastRequestTs = Date.now();
        return self._query(query + ' golf');
      })
      .then(function (results) {
        var list = (results || []).slice();
        list.sort(function (a, b) {
          return (self._isGolf(a) ? 0 : 1) - (self._isGolf(b) ? 0 : 1);
        });
        self._renderDropdown(list.slice(0, 10), onSelect);
      })
      .catch(function (err) {
        self._renderMessage(err && err.blocked
          ? 'Suche vorübergehend blockiert (Nominatim). Bitte 1–2 Sekunden warten und erneut tippen.'
          : 'Suche nicht erreichbar. Internetverbindung/Proxy prüfen.');
      });
  },

  _renderDropdown: function (results, onSelect) {
    var self = this;
    var dropdownEl = self._dropdownEl;
    var inputEl    = self._inputEl;

    dropdownEl.innerHTML = '';
    var ul = document.createElement('ul');

    if (!results || results.length === 0) {
      var noResult = document.createElement('li');
      noResult.textContent = 'Keine Ergebnisse – versuchen Sie es mit Ort/Land, z. B. „Name Stadt".';
      noResult.style.cursor = 'default';
      noResult.style.color  = '#888';
      ul.appendChild(noResult);
    } else {
      results.forEach(function (r) {
        var li = document.createElement('li');
        li.textContent = (self._isGolf(r) ? '⛳ ' : '') + r.display_name;

        li.addEventListener('mousedown', function (e) {
          e.preventDefault();

          var selected = {
            lat:         parseFloat(r.lat),
            lon:         parseFloat(r.lon),
            displayName: r.display_name
          };

          self._selectedResult  = selected;
          inputEl.value         = r.display_name;
          self._clearDropdown();

          if (typeof onSelect === 'function') {
            onSelect(selected);
          }
        });

        ul.appendChild(li);
      });
    }

    dropdownEl.appendChild(ul);
    dropdownEl.classList.add('open');
  },

  _renderMessage: function (text) {
    var dropdownEl = this._dropdownEl;
    if (!dropdownEl) { return; }
    dropdownEl.innerHTML = '';
    var ul = document.createElement('ul');
    var li = document.createElement('li');
    li.textContent = text;
    li.style.cursor = 'default';
    li.style.color  = '#b00';
    ul.appendChild(li);
    dropdownEl.appendChild(ul);
    dropdownEl.classList.add('open');
  },

  _clearDropdown: function () {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this._dropdownEl) {
      this._dropdownEl.innerHTML = '';
      this._dropdownEl.classList.remove('open');
    }
  },

  getSelected: function () {
    return this._selectedResult;
  },

  reset: function () {
    this._selectedResult = null;
    this._clearDropdown();
  }
};
