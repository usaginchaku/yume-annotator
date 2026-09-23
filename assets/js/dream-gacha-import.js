(function(root){
  'use strict';

  const SCHEMA = 'dream-gacha.novel-export';
  const SUPPORTED_VERSION = 1;
  const RATINGS = new Set([-1, 0, 1, 2, 3]);
  const text = value => typeof value === 'string' ? value : '';
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function headerVersion(value) {
    const firstLine = text(value).split(/\r?\n/, 1)[0];
    return firstLine.match(/夢小説生成プロンプト\s+Ver\.([\d]+(?:\.[\d]+)+)/)?.[1] || null;
  }

  function validate(payload) {
    if (!record(payload) || payload.schema !== SCHEMA) {
      throw new Error('DreamGachaの夢小説エクスポート形式ではありません。');
    }
    const version = Number(payload.version);
    if (!Number.isInteger(version) || version < 1) {
      throw new Error('DreamGachaエクスポートのバージョンが不正です。');
    }
    if (version > SUPPORTED_VERSION) {
      throw new Error('このツールより新しいDreamGachaエクスポート形式です。');
    }
    const novel = record(payload.novel);
    if (!novel) throw new Error('夢小説データが見つかりません。');
    if (!text(novel.id).trim()) throw new Error('夢小説の識別情報がありません。');
    if (!text(novel.body).trim()) throw new Error('夢小説本文が空です。');
    return { payload, novel, snapshot:record(novel.snapshot) || {} };
  }

  function importAnnotations(payload, body, workId, now) {
    const source = record(payload.annotation);
    if (!source || !Array.isArray(source.annotations)) return [];
    return source.annotations.flatMap(annotation => {
      const item = record(annotation);
      if (!item) return [];
      const start = Number(item.start), end = Number(item.end), rating = Number(item.rating);
      const quote = text(item.quote);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > body.length) return [];
      if (!quote || body.slice(start, end) !== quote || !RATINGS.has(rating)) return [];
      return [{
        id:text(item.id).trim() || `annotation-${now.replace(/\W/g, '')}-${start}`,
        work_id:workId,
        quote,
        start,
        end,
        rating,
        comment:text(item.comment),
        created_at:text(item.created_at || item.createdAt) || now,
        updated_at:text(item.updated_at || item.updatedAt) || now
      }];
    });
  }

  function toWork(payload, options={}) {
    const checked = validate(payload);
    const novel = checked.novel, snapshot = checked.snapshot;
    const promptPayload = record(payload.prompt) || {};
    const promptRecord = record(promptPayload.record) || record(snapshot.promptRecord) || {};
    const revision = record(promptRecord.revision);
    const promptText = text(promptPayload.text) || text(snapshot.prompt) || text(promptRecord.assembledPrompt);
    const detectedHeaderVersion = headerVersion(promptText);
    const explicitHeaderVersion = text(promptPayload.headerVersion).trim();
    const standardVersion = text(revision?.standardVersion).trim();
    const promptVersion = explicitHeaderVersion || standardVersion || detectedHeaderVersion || 'unknown';
    const character = record(snapshot.character) || {};
    const now = text(options.now) || new Date().toISOString();
    const workId = text(options.id).trim() || `work-${Date.now().toString(36)}`;
    const annotationPayload = record(payload.annotation) || {};

    return {
      id:workId,
      title:text(novel.title).trim() || '無題',
      character:text(character.name).trim(),
      prompt_version:promptVersion,
      full_text:text(novel.body),
      series:text(character.work).trim(),
      pair_id:'',
      scenario:text(snapshot.situation).trim(),
      notes:text(novel.memo),
      created_at:now,
      updated_at:now,
      annotations:importAnnotations(payload, text(novel.body), workId, now),
      source:{
        app:'dream-gacha',
        schema:SCHEMA,
        schema_version:Number(payload.version),
        novel_id:text(novel.id),
        exported_at:text(payload.exportedAt),
        novel_created_at:text(novel.createdAt),
        novel_updated_at:text(novel.updatedAt),
        favorite:!!novel.favorite,
        offset_unit:text(annotationPayload.offsetUnit) || 'UTF-16',
        review_status:text(annotationPayload.reviewStatus) || 'unknown'
      },
      prompt_info:{
        text:promptText,
        version_id:text(promptPayload.versionId || revision?.id) || null,
        header_version:explicitHeaderVersion || detectedHeaderVersion,
        detected_header_version:detectedHeaderVersion,
        standard_version:standardVersion || null,
        status:text(promptPayload.status) || (revision ? 'recorded' : 'unknown'),
        revision:clone(revision)
      },
      generation:{
        character:clone(character),
        relationship:text(snapshot.relationship),
        situation:text(snapshot.situation),
        mood:text(snapshot.mood),
        extra:text(snapshot.extra),
        free_extra:text(snapshot.freeExtra),
        protagonist_profile:text(snapshot.protagonistProfile),
        work_protagonist_profile:text(snapshot.workProtagonistProfile),
        world_mode:text(snapshot.worldMode),
        prompt_context:clone(record(snapshot.promptContext)),
        saved_at:text(snapshot.savedAt)
      }
    };
  }

  root.DreamGachaImport = { SCHEMA, SUPPORTED_VERSION, headerVersion, validate, toWork };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DreamGachaImport;
})(typeof globalThis !== 'undefined' ? globalThis : this);
