const test = require('node:test');
const assert = require('node:assert/strict');
const importer = require('../dream-gacha-import.js');

function fixture(overrides={}) {
  return {
    schema:'dream-gacha.novel-export', version:1, exportedAt:'2026-09-13T00:00:00Z',
    novel:{
      id:'novel-1', title:'題名', body:'本文😀です', memo:'メモ', favorite:true,
      createdAt:'2026-09-12T00:00:00Z', updatedAt:'2026-09-12T01:00:00Z',
      snapshot:{
        character:{id:'char-1', name:'キャラ', work:'原作', series:'第1部', tags:['冷静'], heightText:'180cm', heightCm:180},
        relationship:'恋人', situation:'雨宿り', mood:'静か', extra:'夜', freeExtra:'自由指定',
        protagonistProfile:'夢主設定', workProtagonistProfile:'作品別設定', worldMode:'canon',
        prompt:'# 夢小説生成プロンプト Ver.0.1.3.2\n\n固定文と条件',
        promptRecord:{revision:{id:'prompt-1',label:'',baseText:'固定文',standardText:'標準文',standardVersion:'0.1.3.2',createdAt:'date'},assembledPrompt:'assembled'},
        promptContext:{version:1,settings:{style:'',entries:[{id:'setting-1',title:'設定'}]},selection:{stageId:'',manualIds:[],excludedIds:[]},output:{length:'短編',pov:'一人称'}},
        savedAt:'2026-09-12T02:00:00Z'
      }
    },
    prompt:{text:'# 夢小説生成プロンプト Ver.0.1.3.2\n\n固定文と条件',record:null,versionId:'prompt-1',headerVersion:'0.1.3.2',status:'recorded'},
    annotation:{sourceNovelId:'novel-1',text:'本文😀です',offsetUnit:'UTF-16',reviewStatus:'unknown',annotations:[]},
    ...overrides
  };
}

test('DreamGacha export becomes an annotation work without losing provenance', () => {
  const source = fixture(), before = JSON.stringify(source);
  const work = importer.toWork(source, {id:'work-1', now:'2026-09-13T03:00:00Z'});
  assert.equal(work.title, '題名');
  assert.equal(work.full_text, '本文😀です');
  assert.equal(work.character, 'キャラ');
  assert.equal(work.series, '原作');
  assert.equal(work.scenario, '雨宿り');
  assert.equal(work.prompt_version, '0.1.3.2');
  assert.equal(work.source.novel_id, 'novel-1');
  assert.equal(work.prompt_info.version_id, 'prompt-1');
  assert.equal(work.prompt_info.revision.standardVersion, '0.1.3.2');
  assert.equal(work.generation.character.series, '第1部');
  assert.equal(work.generation.relationship, '恋人');
  assert.equal(work.generation.prompt_context.output.pov, '一人称');
  assert.equal(JSON.stringify(source), before);
});

test('version falls back from export metadata to the prompt header', () => {
  const source = fixture();
  source.prompt.headerVersion = '';
  source.novel.snapshot.promptRecord = null;
  source.prompt.record = null;
  assert.equal(importer.toWork(source, {id:'w'}).prompt_version, '0.1.3.2');
  source.prompt.text = '版表記なし';
  source.novel.snapshot.prompt = '';
  assert.equal(importer.toWork(source, {id:'w'}).prompt_version, 'unknown');
});

test('only valid UTF-16 anchored annotations are imported', () => {
  const source = fixture();
  source.annotation.annotations = [
    {id:'a1', quote:'😀', start:2, end:4, rating:3, comment:'好き'},
    {id:'a2', quote:'不一致', start:0, end:2, rating:-1},
    {id:'a3', quote:'本文', start:0, end:2, rating:9}
  ];
  const work = importer.toWork(source, {id:'w', now:'now'});
  assert.equal(work.annotations.length, 1);
  assert.deepEqual(work.annotations[0], {id:'a1',work_id:'w',quote:'😀',start:2,end:4,rating:3,comment:'好き',created_at:'now',updated_at:'now'});
});

test('invalid and unsupported exports are rejected', () => {
  assert.throws(() => importer.toWork({}), /DreamGacha/);
  assert.throws(() => importer.toWork({...fixture(), version:2}), /新しい/);
  const empty = fixture(); empty.novel.body = '';
  assert.throws(() => importer.toWork(empty), /本文が空/);
});
