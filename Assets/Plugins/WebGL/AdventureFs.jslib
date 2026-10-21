// 웹 빌드: 저장 파일(persistentDataPath)이 브라우저 저장소(IndexedDB)에 바로 남도록 파일 시스템을 동기화한다.
mergeInto(LibraryManager.library, {
  AdventureSyncFs: function () {
    if (typeof FS === 'undefined' || !FS.syncfs) return;
    FS.syncfs(false, function (err) {
      if (err) console.log('save sync failed: ' + err);
    });
  }
});
