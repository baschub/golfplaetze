/**
 * backup.js — File System Access API auto-backup, manual export/import.
 */

window.BackupManager = {
  _fileHandle: null,
  _getDataFn: null,
  BACKUP_FLAG_KEY: 'golfplaetze_backup_linked',

  FILE_OPTIONS: {
    suggestedName: 'golfplaetze-backup.json',
    types: [{
      description: 'JSON Backup',
      accept: { 'application/json': ['.json'] }
    }]
  },

  init: function (getDataFn) {
    this._getDataFn = getDataFn;

    var self      = this;
    var setupBtn  = document.getElementById('setup-backup-btn');
    var relinkBtn = document.getElementById('relink-backup-btn');
    var apiNote   = document.getElementById('backup-api-note');
    var notice    = document.getElementById('backup-notice');

    document.getElementById('export-btn').addEventListener('click', function () {
      self.manualExport();
    });
    document.getElementById('import-btn').addEventListener('click', function () {
      document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', function (e) {
      self.handleImport(e);
    });

    if (typeof window.showSaveFilePicker !== 'function') {
      if (setupBtn)  { setupBtn.style.display  = 'none'; }
      if (relinkBtn) { relinkBtn.style.display = 'none'; }
      if (apiNote) {
        apiNote.style.display = 'block';
        apiNote.textContent   = 'Automatisches Backup nicht verfügbar (Browser unterstützt die ' +
                                'File System Access API nicht). Bitte nutzen Sie den manuellen Export.';
      }
      return;
    }

    if (relinkBtn) { relinkBtn.style.display = 'none'; }

    if (localStorage.getItem(this.BACKUP_FLAG_KEY) === '1') {
      if (notice) {
        notice.textContent   = 'Eine Backup-Datei war verknüpft. Klicken Sie auf ' +
                               '\u201eBackup neu verkn\u00fcpfen\u201c, um das automatische ' +
                               'Backup wiederherzustellen.';
        notice.style.display = 'block';
      }
      if (relinkBtn) { relinkBtn.style.display = 'block'; }
    }

    if (setupBtn)  { setupBtn.addEventListener('click',  function () { self.setupAutoBackup(); }); }
    if (relinkBtn) { relinkBtn.addEventListener('click', function () { self.setupAutoBackup(); }); }
  },

  setupAutoBackup: async function () {
    try {
      var handle = await window.showSaveFilePicker(this.FILE_OPTIONS);
      this._fileHandle = handle;
      localStorage.setItem(this.BACKUP_FLAG_KEY, '1');
      await this._writeToHandle(this._getDataFn());
      this._updateStatusUI('Backup aktiv \u2713', true);
      var notice = document.getElementById('backup-notice');
      if (notice) { notice.style.display = 'none'; }
    } catch (e) {
      if (e.name !== 'AbortError') {
        this._showError('Backup konnte nicht eingerichtet werden: ' + e.message);
      }
    }
  },

  autoSave: async function () {
    if (!this._fileHandle) { return; }
    try {
      await this._writeToHandle(this._getDataFn());
    } catch (e) {
      this._fileHandle = null;
      localStorage.removeItem(this.BACKUP_FLAG_KEY);
      this._updateStatusUI('Kein automatisches Backup', false);
      this._showError('Backup-Fehler: Die Verbindung zur Backup-Datei wurde unterbrochen. ' +
                      'Bitte richten Sie das automatische Backup neu ein.');
    }
  },

  _writeToHandle: async function (data) {
    var writable = await this._fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  },

  manualExport: function () {
    var data = this._getDataFn();
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'golfplaetze-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  handleImport: function (event) {
    var file = event.target.files[0];
    if (!file) { return; }

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data.version || !Array.isArray(data.courses)) {
          alert('Ung\u00fcltige Backup-Datei. Das Format wird nicht erkannt.');
          return;
        }
        if (confirm('Alle aktuellen Daten werden durch die importierten Daten ersetzt. Fortfahren?')) {
          App.data = data;
          App.saveData();
          MapManager.clearAll();
          App.data.courses.forEach(function (c) {
            MapManager.addMarker(c, App._onMarkerClick.bind(App));
          });
          App.renderList();
          App.populateYearFilter();
          alert('Import erfolgreich: ' + data.courses.length + ' Golfpl\u00e4tze geladen.');
        }
      } catch (err) {
        alert('Fehler beim Importieren: Die Datei konnte nicht gelesen werden.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  },

  _updateStatusUI: function (text, active) {
    var textEl      = document.getElementById('backup-status-text');
    var containerEl = document.getElementById('backup-status');
    if (textEl) { textEl.textContent = text; }
    if (containerEl) {
      if (active) {
        containerEl.classList.add('backup-active');
      } else {
        containerEl.classList.remove('backup-active');
      }
    }
  },

  _showError: function (msg) {
    var el = document.getElementById('backup-error-msg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'backup-error-msg';
      el.style.cssText = 'background:#f8d7da;border:1px solid #f5c6cb;border-radius:4px;' +
                         'padding:6px 10px;font-size:0.8rem;color:#721c24;margin-top:8px;' +
                         'display:none;';
      var panel = document.getElementById('backup-panel');
      if (panel) { panel.appendChild(el); }
    }
    el.textContent   = msg;
    el.style.display = 'block';

    if (el._hideTimer) { clearTimeout(el._hideTimer); }
    el._hideTimer = setTimeout(function () {
      el.style.display = 'none';
    }, 6000);
  }
};

// HINWEIS: In backup.js wird App._onMarkerClick verwendet (statt des früheren
// App.openEditModal). Das ist beabsichtigt und passt zur aktuellen app.js.
