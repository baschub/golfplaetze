/**
 * map.js — Leaflet map initialisation and marker lifecycle.
 * Exposes window.MapManager.
 * Depends on: Leaflet (L) loaded before this file.
 */

window.MapManager = {
  _map: null,
  _markers: new Map(),
  LAYER_PREF_KEY: 'golfplaetze_saved_layer',

  init: function (containerId) {
    this._map = L.map(containerId, {
      center: [20, 0],
      zoom: 2,
      worldCopyJump: true
    });

    // 1. Standard Straßenkarte (OpenStreetMap)
    var karteLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
    });

    // 2. Satellitenbild (ESRI World Imagery)
    var satImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '© <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
    });

    // 3. Beschriftungen, Orte & Ländergrenzen (ESRI Boundaries & Places)
    var satLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: ''
    });

    // Kombinierter Satellitenmodus mit Beschriftungen & Grenzen (Hybrid)
    var satellitHybridLayer = L.layerGroup([satImagery, satLabels]);

    // Zuletzt benutzte Ansicht ermitteln (Standard: 'Karte')
    var savedLayerName = localStorage.getItem(this.LAYER_PREF_KEY) || 'Karte';

    if (savedLayerName === 'Satellit') {
      satellitHybridLayer.addTo(this._map);
    } else {
      karteLayer.addTo(this._map);
    }

    // Ebenenauswahl-Widget oben rechts hinzufügen
    var baseMaps = {
      'Karte': karteLayer,
      'Satellit': satellitHybridLayer
    };

    L.control.layers(baseMaps, null, {
      position: 'topright',
      collapsed: false
    }).addTo(this._map);

    // Auswahl merken, sobald der Nutzer umschaltet
    var self = this;
    this._map.on('baselayerchange', function (e) {
      localStorage.setItem(self.LAYER_PREF_KEY, e.name);
    });
  },

  _makeIcon: function () {
    return L.divIcon({
      html: '<div class="golf-pin"><span class="golf-pin-glyph">⛳</span></div>',
      className: 'golf-pin-wrapper',
      iconSize: [36, 48],
      iconAnchor: [18, 46],
      popupAnchor: [0, -44],
      tooltipAnchor: [0, -40]
    });
  },

  addMarker: function (course, onEditClick) {
    var marker = L.marker([course.lat, course.lon], { icon: this._makeIcon() });

    // Modernes Popup mit strukturierter Formatierung
    var popupHtml = '<div style="font-family:system-ui,sans-serif; line-height:1.4; min-width:160px;">' +
      '<strong style="font-size:1rem; color:#2d6a4f; display:block; margin-bottom:4px;">' +
      course.name.replace(/</g, '&lt;') +
      '</strong>';

    if (course.years && course.years.length > 0) {
      popupHtml += '<span style="font-size:0.8rem; color:#555; display:block;">📅 ' + course.years.join(', ') + '</span>';
    }

    if (course.rating) {
      var stars = '';
      for (var i = 1; i <= 5; i++) { stars += (i <= course.rating ? '★' : '☆'); }
      popupHtml += '<span style="color:#f5a623; font-size:0.95rem; display:block; margin:2px 0;">' + stars + '</span>';
    }

    if (course.comment) {
      popupHtml += '<p style="margin:6px 0 0; font-size:0.82rem; font-style:italic; color:#333; border-top:1px solid #eee; padding-top:4px;">' +
        course.comment.replace(/</g, '&lt;') +
        '</p>';
    }
    popupHtml += '</div>';

    // Ausschliesslich das moderne Popup binden (kein bindTooltip mehr)
    marker.bindPopup(popupHtml, {
      maxWidth: 280,
      autoPan: true,
      autoPanPadding: [20, 20]
    });

    marker.on('click', function () {
      if (typeof onEditClick === 'function') {
        onEditClick(course.id);
      }
    });

    marker.addTo(this._map);
    this._markers.set(course.id, marker);
  },

  removeMarker: function (courseId) {
    var marker = this._markers.get(courseId);
    if (marker) {
      marker.remove();
      this._markers.delete(courseId);
    }
  },

  updateMarker: function (course, onEditClick) {
    this.removeMarker(course.id);
    this.addMarker(course, onEditClick);
  },

  showOnlyIds: function (courseIdSet) {
    var self = this;
    self._markers.forEach(function (marker, id) {
      if (courseIdSet.has(id)) {
        if (!self._map.hasLayer(marker)) {
          marker.addTo(self._map);
        }
      } else {
        if (self._map.hasLayer(marker)) {
          marker.remove();
        }
      }
    });
  },

  _highlightedId: null,

  highlightMarker: function (courseId) {
    this.clearHighlight();
    var marker = this._markers.get(courseId);
    if (!marker) { return; }
    this._highlightedId = courseId;
    marker.setIcon(this._makeHighlightedIcon());
    if (marker.setZIndexOffset) { marker.setZIndexOffset(900); }
  },

  clearHighlight: function () {
    if (!this._highlightedId) { return; }
    var prev = this._markers.get(this._highlightedId);
    if (prev) {
      prev.setIcon(this._makeIcon());
      if (prev.setZIndexOffset) { prev.setZIndexOffset(0); }
    }
    this._highlightedId = null;
  },

  _makeHighlightedIcon: function () {
    return L.divIcon({
      html: '<div class="golf-pin golf-pin--highlighted"><span class="golf-pin-glyph">⛳</span></div>',
      className: 'golf-pin-wrapper',
      iconSize: [42, 54],
      iconAnchor: [21, 52],
      popupAnchor: [0, -50],
      tooltipAnchor: [0, -46]
    });
  },

  flyTo: function (courseId) {
    var marker = this._markers.get(courseId);
    if (marker) {
      this._map.flyTo(marker.getLatLng(), 12, { duration: 1.5 });
    }
  },

  getMap: function () {
    return this._map;
  },

  _placingMarker: null,
  _placeClickHandler: null,

  startPlacing: function (onChange) {
    var self = this;
    this.stopPlacing();

    var container = this._map.getContainer();
    container.classList.add('placing-mode');

    this._placeClickHandler = function (e) {
      var lat = e.latlng.lat;
      var lon = e.latlng.lng;

      if (!self._placingMarker) {
        self._placingMarker = L.marker([lat, lon], {
          icon: self._makeIcon(),
          draggable: true,
          zIndexOffset: 1000
        }).addTo(self._map);

        self._placingMarker.on('dragend', function () {
          var p = self._placingMarker.getLatLng();
          if (typeof onChange === 'function') { onChange(p.lat, p.lng); }
        });
      } else {
        self._placingMarker.setLatLng([lat, lon]);
      }

      if (typeof onChange === 'function') { onChange(lat, lon); }
    };

    this._map.on('click', this._placeClickHandler);
  },

  stopPlacing: function () {
    if (this._placeClickHandler) {
      this._map.off('click', this._placeClickHandler);
      this._placeClickHandler = null;
    }
    if (this._placingMarker) {
      this._placingMarker.remove();
      this._placingMarker = null;
    }
    if (this._map) {
      this._map.getContainer().classList.remove('placing-mode');
    }
  },

  getPlacingPosition: function () {
    if (!this._placingMarker) { return null; }
    var p = this._placingMarker.getLatLng();
    return { lat: p.lat, lon: p.lng };
  },

  clearAll: function () {
    this._markers.forEach(function (marker) {
      marker.remove();
    });
    this._markers.clear();
  }
};
