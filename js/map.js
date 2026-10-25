/**
 * map.js — Leaflet map initialisation and marker lifecycle.
 * Exposes window.MapManager.
 * Depends on: Leaflet (L) loaded before this file.
 */

window.MapManager = {
  _map: null,
  _markers: new Map(),

  init: function (containerId) {
    this._map = L.map(containerId, {
      center: [20, 0],
      zoom: 2,
      worldCopyJump: true
    });

    // Base layers: Karte (OpenStreetMap) und Satellit (ESRI World Imagery)
    var karteLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
    });

    var satellitLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '© <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
    });

    karteLayer.addTo(this._map);

    L.control.layers(
      { 'Karte': karteLayer, 'Satellit': satellitLayer },
      null,
      { position: 'topright', collapsed: false }
    ).addTo(this._map);
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

    var tooltipText = course.name;
    if (course.years && course.years.length > 0) {
      tooltipText += ' | ' + course.years.join(', ');
    }
    if (course.rating) {
      var stars = '';
      for (var i = 1; i <= 5; i++) { stars += (i <= course.rating ? '★' : '☆'); }
      tooltipText += ' | ' + stars;
    }
    if (course.comment) {
      tooltipText += '<br><em>' + course.comment.replace(/</g, '&lt;') + '</em>';
    }

    marker.bindTooltip(tooltipText, {
      permanent: false,
      sticky: false
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
