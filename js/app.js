/**
 * app.js — Main application entry point.
 * Wires Storage, MapManager, Geocoder and BackupManager together.
 * Load order: storage.js → map.js → geocode.js → backup.js → app.js
 */

window.App = {
  data: null,
  _editingId: null,
  _pendingGeo: null,
  _pendingYears: [],
  _addMode: 'search',
  _pendingMapPoint: null,
  _selectedId: null,

  saveData: function () {
    Storage.save(App.data);
    BackupManager.autoSave();
  },

  _validateYear: function (value) {
    var n = parseInt(value, 10);
    var maxYear = new Date().getFullYear() + 1;
    if (isNaN(n) || n < 1900 || n > maxYear) {
      return null;
    }
    return n;
  },

  _makeYearTag: function (year, onRemove) {
    var span = document.createElement('span');
    span.className = 'year-tag';
    span.appendChild(document.createTextNode(year + ' '));

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'year-tag-remove';
    btn.setAttribute('data-year', String(year));
    btn.setAttribute('aria-label', 'Jahr ' + year + ' entfernen');
    btn.textContent = '×';
    btn.addEventListener('click', onRemove);

    span.appendChild(btn);
    return span;
  },

  _renderPendingYearsList: function () {
    var container = document.getElementById('years-list');
    container.innerHTML = '';
    App._pendingYears.forEach(function (year) {
      container.appendChild(App._makeYearTag(year, function () {
        App._pendingYears = App._pendingYears.filter(function (y) { return y !== year; });
        App._renderPendingYearsList();
      }));
    });
  },

  _starsToString: function (rating) {
    if (!rating) { return ''; }
    var s = '';
    for (var i = 1; i <= 5; i++) { s += (i <= rating ? '★' : '☆'); }
    return s;
  },

  _initStarWidget: function (container, initial) {
    var stars = container.querySelectorAll('.star');
    var value = initial || 0;

    function render(v) {
      value = v;
      container.setAttribute('data-value', String(v));
      stars.forEach(function (s) {
        var sv = parseInt(s.getAttribute('data-star'), 10);
        s.textContent = sv <= v ? '★' : '☆';
        s.classList.toggle('active', sv <= v);
      });
    }

    stars.forEach(function (s) {
      s.addEventListener('click', function () {
        var clicked = parseInt(s.getAttribute('data-star'), 10);
        render(clicked === value ? 0 : clicked);
      });
    });

    render(value);
  },

  _getStarValue: function (container) {
    return parseInt(container.getAttribute('data-value'), 10) || 0;
  },

  _renderEditYearsList: function (course) {
    var container = document.getElementById('edit-years-list');
    container.innerHTML = '';
    (course.years || []).forEach(function (year) {
      container.appendChild(App._makeYearTag(year, function () {
        var c = App.data.courses.find(function (x) { return x.id === App._editingId; });
        if (!c) { return; }
        c.years = c.years.filter(function (y) { return y !== year; });
        App.saveData();
        MapManager.updateMarker(c, App._onMarkerClick.bind(App));
        App._renderEditYearsList(c);
        App.populateYearFilter();
        App.renderList();
      }));
    });
  },

  _addPendingYear: function () {
    var yearInput = document.getElementById('year-input');
    var year = App._validateYear(yearInput.value);
    if (year === null) {
      alert('Bitte geben Sie ein gültiges Jahr zwischen 1900 und ' +
            (new Date().getFullYear() + 1) + ' ein.');
      return;
    }
    if (App._pendingYears.indexOf(year) !== -1) {
      alert('Dieses Jahr wurde bereits hinzugefügt.');
      return;
    }
    App._pendingYears.push(year);
    App._pendingYears.sort(function (a, b) { return a - b; });
    yearInput.value = '';
    App._renderPendingYearsList();
  },

  addCourse: function () {
    var name, displayName, lat, lon;

    if (App._addMode === 'map') {
      if (!App._pendingMapPoint) {
        alert('Bitte setzen Sie zuerst einen Punkt auf der Karte.');
        return;
      }
      var typedName = document.getElementById('map-name-input').value.trim();
      if (!typedName) {
        alert('Bitte geben Sie einen Namen für den Golfplatz ein.');
        return;
      }
      name        = typedName;
      displayName = typedName;
      lat         = App._pendingMapPoint.lat;
      lon         = App._pendingMapPoint.lon;
    } else {
      if (!App._pendingGeo) {
        alert('Bitte wählen Sie einen Golfplatz aus der Vorschlagsliste aus.');
        return;
      }
      displayName = App._pendingGeo.displayName;
      name        = displayName.split(',')[0].trim();
      lat         = App._pendingGeo.lat;
      lon         = App._pendingGeo.lon;
    }

    if (App._pendingYears.length === 0) {
      alert('Bitte geben Sie mindestens ein Jahr ein.');
      return;
    }

    var course = {
      id:          Storage.generateId(),
      name:        name,
      displayName: displayName,
      lat:         lat,
      lon:         lon,
      years:       App._pendingYears.slice().sort(function (a, b) { return a - b; }),
      rating:      App._getStarValue(document.getElementById('rating-input')),
      comment:     (document.getElementById('comment-input').value || '').trim()
    };

    App.data.courses.push(course);
    App.saveData();
    MapManager.addMarker(course, App._onMarkerClick.bind(App));
    App.renderList();
    App.populateYearFilter();

    document.getElementById('search-input').value   = '';
    document.getElementById('map-name-input').value = '';
    document.getElementById('year-input').value     = '';
    document.getElementById('years-list').innerHTML = '';
    document.getElementById('place-coords').textContent = '';
    document.getElementById('comment-input').value  = '';
    App._initStarWidget(document.getElementById('rating-input'), 0);
    App._pendingGeo      = null;
    App._pendingYears    = [];
    App._pendingMapPoint = null;
    Geocoder.reset();
    MapManager.stopPlacing();
  },

  setAddMode: function (mode) {
    App._addMode = mode;

    var isMap = (mode === 'map');
    document.getElementById('mode-search').style.display = isMap ? 'none' : '';
    document.getElementById('mode-map').style.display    = isMap ? '' : 'none';

    document.getElementById('mode-search-btn').classList.toggle('active', !isMap);
    document.getElementById('mode-map-btn').classList.toggle('active', isMap);
    document.getElementById('mode-search-btn').setAttribute('aria-selected', String(!isMap));
    document.getElementById('mode-map-btn').setAttribute('aria-selected', String(isMap));

    if (!isMap) {
      MapManager.stopPlacing();
      App._pendingMapPoint = null;
      document.getElementById('place-coords').textContent = '';
    } else {
      App._pendingGeo = null;
      Geocoder.reset();
    }
  },

  openEditModal: function (courseId) {
    var course = App.data.courses.find(function (c) { return c.id === courseId; });
    if (!course) { return; }

    App._editingId = courseId;

    document.getElementById('edit-display-name').textContent = course.displayName || course.name;
    document.getElementById('edit-name').value  = course.name;
    document.getElementById('edit-year-input').value = '';
    document.getElementById('edit-comment').value = course.comment || '';
    App._initStarWidget(document.getElementById('edit-rating'), course.rating || 0);
    App._renderEditYearsList(course);

    document.getElementById('edit-modal').classList.add('open');
  },

  selectCourse: function (courseId, flyTo) {
    if (App._selectedId === courseId) {
      App._selectedId = null;
      MapManager.clearHighlight();
      App._highlightListItem(null);
      return;
    }
    App._selectedId = courseId;
    MapManager.highlightMarker(courseId);
    App._highlightListItem(courseId);
    if (flyTo) {
      MapManager.flyTo(courseId);
    }
  },

  _onMarkerClick: function (courseId) {
    App.selectCourse(courseId, false);
  },

  _highlightListItem: function (courseId) {
    var list = document.getElementById('course-list');
    var items = list.querySelectorAll('li');
    items.forEach(function (li) {
      if (li.getAttribute('data-id') === courseId) {
        li.classList.add('highlighted');
        li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        li.classList.remove('highlighted');
      }
    });
  },

  _sortCourses: function (courses) {
    var sel = document.getElementById('sort-select');
    var mode = sel ? sel.value : 'name-asc';

    function maxYear(c) {
      return (c.years && c.years.length) ? Math.max.apply(null, c.years) : -Infinity;
    }
    function minYear(c) {
      return (c.years && c.years.length) ? Math.min.apply(null, c.years) : Infinity;
    }
    function byName(a, b) {
      return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
    }

    courses.sort(function (a, b) {
      switch (mode) {
        case 'name-desc':   return byName(b, a);
        case 'rating-desc': return (b.rating || 0) - (a.rating || 0) || byName(a, b);
        case 'rating-asc':  return (a.rating || 0) - (b.rating || 0) || byName(a, b);
        case 'year-desc':   return maxYear(b) - maxYear(a) || byName(a, b);
        case 'year-asc':    return minYear(a) - minYear(b) || byName(a, b);
        case 'name-asc':
        default:            return byName(a, b);
      }
    });
  },

  renderList: function () {
    var nameFilter = (document.getElementById('filter-name').value || '').toLowerCase().trim();
    var yearFilter = document.getElementById('filter-year').value;
    var yearInt    = yearFilter ? parseInt(yearFilter, 10) : null;
    var ratingFilter = document.getElementById('filter-rating').value;
    var ratingMin    = ratingFilter ? parseInt(ratingFilter, 10) : null;

    var total = App.data.courses.length;

    var filtered = App.data.courses.filter(function (c) {
      var nameMatch = !nameFilter ||
        (c.name        && c.name.toLowerCase().indexOf(nameFilter)        !== -1) ||
        (c.displayName && c.displayName.toLowerCase().indexOf(nameFilter) !== -1);
      var yearMatch = (yearInt === null) ||
        (c.years && c.years.indexOf(yearInt) !== -1);
      var ratingMatch = (ratingMin === null) ||
        ((c.rating || 0) >= ratingMin);
      return nameMatch && yearMatch && ratingMatch;
    });

    App._sortCourses(filtered);

    var list = document.getElementById('course-list');
    list.innerHTML = '';

    filtered.forEach(function (course) {
      var li = document.createElement('li');
      li.setAttribute('data-id', course.id);
      if (course.id === App._selectedId) {
        li.classList.add('highlighted');
      }

      var infoDiv = document.createElement('div');
      infoDiv.className = 'course-info';
      infoDiv.style.flex     = '1';
      infoDiv.style.overflow = 'hidden';
      infoDiv.style.minWidth = '0';
      (function (id) {
        infoDiv.addEventListener('click', function () {
          App.selectCourse(id, true);
        });
      }(course.id));

      var nameSpan = document.createElement('span');
      nameSpan.className   = 'course-item-name';
      nameSpan.textContent = course.name;

      var yearsSpan = document.createElement('span');
      yearsSpan.className   = 'course-item-years';
      yearsSpan.textContent = (course.years || []).join(', ');

      infoDiv.appendChild(nameSpan);
      infoDiv.appendChild(yearsSpan);

      if (course.rating) {
        var starsSpan = document.createElement('span');
        starsSpan.className   = 'stars-display';
        starsSpan.textContent = App._starsToString(course.rating);
        infoDiv.appendChild(starsSpan);
      }

      var actionsDiv = document.createElement('div');
      actionsDiv.className = 'course-item-actions';

      var editBtn = document.createElement('button');
      editBtn.type      = 'button';
      editBtn.className = 'btn-primary';
      editBtn.setAttribute('data-id', course.id);
      editBtn.textContent = 'Bearbeiten';
      (function (id) {
        editBtn.addEventListener('click', function () { App.openEditModal(id); });
      }(course.id));

      actionsDiv.appendChild(editBtn);

      li.appendChild(infoDiv);
      li.appendChild(actionsDiv);

      list.appendChild(li);
    });

    var countEl = document.getElementById('course-count');
    if (countEl) {
      if (filtered.length === total) {
        countEl.textContent = total + (total === 1 ? ' Platz' : ' Plätze');
      } else {
        countEl.textContent = filtered.length + ' von ' + total +
                              (total === 1 ? ' Platz' : ' Plätzen');
      }
    }

    var visibleIds = new Set(filtered.map(function (c) { return c.id; }));
    MapManager.showOnlyIds(visibleIds);
  },

  populateYearFilter: function () {
    var select       = document.getElementById('filter-year');
    var currentValue = select.value;

    var yearsMap = {};
    App.data.courses.forEach(function (c) {
      (c.years || []).forEach(function (y) { yearsMap[y] = true; });
    });
    var years = Object.keys(yearsMap).map(Number).sort(function (a, b) { return b - a; });

    while (select.options.length > 1) {
      select.remove(1);
    }

    years.forEach(function (y) {
      var opt = document.createElement('option');
      opt.value       = String(y);
      opt.textContent = String(y);
      select.appendChild(opt);
    });

    if (currentValue && yearsMap[Number(currentValue)]) {
      select.value = currentValue;
    }
  }
};

document.addEventListener('DOMContentLoaded', function () {

  App.data = Storage.load();
  MapManager.init('map');

  App.data.courses.forEach(function (c) {
    MapManager.addMarker(c, App._onMarkerClick.bind(App));
  });

  var searchInput    = document.getElementById('search-input');
  var searchDropdown = document.getElementById('search-dropdown');
  Geocoder.init(searchInput, searchDropdown, function (result) {
    App._pendingGeo = result;
  });

  BackupManager.init(function () { return App.data; });

  App.renderList();
  App.populateYearFilter();

  var maxYearAttr = String(new Date().getFullYear() + 1);
  document.getElementById('year-input').max      = maxYearAttr;
  document.getElementById('edit-year-input').max = maxYearAttr;

  App._initStarWidget(document.getElementById('rating-input'), 0);
  App._initStarWidget(document.getElementById('edit-rating'), 0);

  document.getElementById('filter-name').addEventListener('input', function () {
    App.renderList();
  });
  document.getElementById('filter-year').addEventListener('change', function () {
    App.renderList();
  });
  document.getElementById('filter-rating').addEventListener('change', function () {
    App.renderList();
  });
  document.getElementById('sort-select').addEventListener('change', function () {
    App.renderList();
  });

  document.getElementById('mode-search-btn').addEventListener('click', function () {
    App.setAddMode('search');
  });
  document.getElementById('mode-map-btn').addEventListener('click', function () {
    App.setAddMode('map');
  });

  function formatCoords(lat, lon) {
    return 'Gesetzt: ' + lat.toFixed(5) + ', ' + lon.toFixed(5) +
           ' — zum Verschieben Pin ziehen.';
  }

  document.getElementById('place-on-map-btn').addEventListener('click', function () {
    MapManager.startPlacing(function (lat, lon) {
      App._pendingMapPoint = { lat: lat, lon: lon };
      document.getElementById('place-coords').textContent = formatCoords(lat, lon);
    });
    document.getElementById('place-coords').textContent =
      'Klicken Sie nun auf die gewünschte Stelle in der Karte …';
  });

  var yearInput = document.getElementById('year-input');

  document.getElementById('add-year-btn').addEventListener('click', function () {
    App._addPendingYear();
  });

  yearInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      App._addPendingYear();
    }
  });

  document.getElementById('add-course-btn').addEventListener('click', function () {
    App.addCourse();
  });

  var editYearInput = document.getElementById('edit-year-input');

  document.getElementById('edit-add-year-btn').addEventListener('click', function () {
    var course = App.data.courses.find(function (c) { return c.id === App._editingId; });
    if (!course) { return; }

    var year = App._validateYear(editYearInput.value);
    if (year === null) {
      alert('Bitte geben Sie ein gültiges Jahr zwischen 1900 und ' +
            (new Date().getFullYear() + 1) + ' ein.');
      return;
    }
    if (course.years.indexOf(year) !== -1) {
      alert('Dieses Jahr wurde bereits hinzugefügt.');
      return;
    }

    course.years.push(year);
    course.years.sort(function (a, b) { return a - b; });
    App.saveData();
    MapManager.updateMarker(course, App._onMarkerClick.bind(App));
    editYearInput.value = '';
    App._renderEditYearsList(course);
    App.renderList();
    App.populateYearFilter();
  });

  editYearInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('edit-add-year-btn').click();
    }
  });

  document.getElementById('edit-save-btn').addEventListener('click', function () {
    var course = App.data.courses.find(function (c) { return c.id === App._editingId; });
    if (!course) { return; }

    var newName = document.getElementById('edit-name').value.trim();
    if (!newName) {
      alert('Bitte geben Sie einen Namen ein.');
      return;
    }

    course.name = newName;
    course.rating  = App._getStarValue(document.getElementById('edit-rating'));
    course.comment = (document.getElementById('edit-comment').value || '').trim();
    App.saveData();
    MapManager.updateMarker(course, App._onMarkerClick.bind(App));
    App.renderList();
    document.getElementById('edit-modal').classList.remove('open');
    App._editingId = null;
  });

  function closeEditModal() {
    var course = App.data.courses.find(function (c) { return c.id === App._editingId; });
    if (course) {
      var newName    = document.getElementById('edit-name').value.trim();
      var newRating  = App._getStarValue(document.getElementById('edit-rating'));
      var newComment = (document.getElementById('edit-comment').value || '').trim();
      var changed    = false;

      if (newName && newName !== course.name) { course.name = newName; changed = true; }
      if (newRating !== (course.rating || 0)) { course.rating = newRating; changed = true; }
      if (newComment !== (course.comment || '')) { course.comment = newComment; changed = true; }

      if (changed) {
        App.saveData();
        MapManager.updateMarker(course, App._onMarkerClick.bind(App));
        App.renderList();
      }
    }
    document.getElementById('edit-modal').classList.remove('open');
    App._editingId = null;
  }

  document.getElementById('edit-cancel-btn').addEventListener('click', closeEditModal);

  document.getElementById('edit-delete-btn').addEventListener('click', function () {
    if (!confirm('Soll dieser Golfplatz wirklich gelöscht werden?')) { return; }

    var id = App._editingId;
    App.data.courses = App.data.courses.filter(function (c) { return c.id !== id; });
    App.saveData();
    MapManager.removeMarker(id);
    App._editingId = null;
    document.getElementById('edit-modal').classList.remove('open');
    App.renderList();
    App.populateYearFilter();
  });

  document.getElementById('edit-modal').addEventListener('click', function (e) {
    if (e.target === this) {
      closeEditModal();
    }
  });

  console.log('App initialisiert — ' + App.data.courses.length + ' Plätze geladen.');
});
